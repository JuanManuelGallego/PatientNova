import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Channel } from '../../generated/prisma/enums.js';
import { config } from '../utils/config/config.js';
import { prisma } from '../utils/prisma/prisma-client.js';
import { logger } from '../utils/api/logger.js';
import {
  ONE_TIME_CODE_DEFAULTS,
  areAttemptsExhausted,
  canResend,
  generateNumericCode,
  hashOneTimeCode,
  isCodeExpired,
  verifyOneTimeCode,
} from '../utils/security/one-time-code.js';
import { createCsrfToken } from '../utils/security/csrf.js';
import { safeEqual } from '../utils/security/safe-equal.js';
import { PORTAL_SESSION_TTL_SECONDS, portalSecret, signPortalToken } from '../auth/tokens.js';
import { sendTransactionalEmail } from '../brevo/transactional.js';
import { dispatchMessage } from '../scheduler/dispatch.js';
import { renderOtpEmail } from '../brevo/email-templates.js';
import { providerDisplayName, publicBookingService } from '../public-booking/public-booking.service.js';
import { portalOtpRepository } from './portal-otp.repository.js';
import {
  contactClaims,
  contactHashOf,
  isPhoneContact,
  maskContact,
  type PortalContact,
} from './portal-contact.js';
import { InvalidPortalOtpError } from './portal-otp.errors.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const PORTAL_OTP_LIMITS = {
  ttlMs: ONE_TIME_CODE_DEFAULTS.ttlMs,
  maxAttempts: ONE_TIME_CODE_DEFAULTS.maxAttempts,
  resendCooldownMs: ONE_TIME_CODE_DEFAULTS.resendCooldownMs,
  perEmailPerHour: 5,
  /** Every code on a phone channel costs money and can be triggered anonymously, so these are lower. */
  perPhonePerHour: 3,
  perProviderPerHour: 100,
  perProviderPaidPerHour: 30,
  maxFailuresPerDay: 15,
} as const;

type SkipReason = 'failure-cap' | 'cooldown' | 'email-cap' | 'provider-cap' | 'phone-cap' | 'provider-paid-cap' | 'paid-daily-cap';

/** Reaching one means an attack or a limit set too low, so these reach error tracking; the others are routine. */
const PAID_CAPS = new Set<SkipReason>([ 'phone-cap', 'provider-paid-cap', 'paid-daily-cap' ]);

function ttlMinutes(): number {
  return Math.round(PORTAL_OTP_LIMITS.ttlMs / 60_000);
}

/** Runs after commit and never throws: the patient recovers by asking again, and the answer does not depend on it. */
async function sendPortalOtp(contact: PortalContact, code: string, providerName: string): Promise<boolean> {
  if (!isPhoneContact(contact)) {
    const { sent } = await sendTransactionalEmail(contact.value, renderOtpEmail({ code, providerName, ttlMinutes: ttlMinutes() }));
    return sent;
  }
  const { channel } = contact;
  try {
    const { success } = await dispatchMessage(channel, { to: contact.value, contentSid: config.twilio.patientPortal.otpSid, contentVariables: { '1': code } });
    if (!success) logger.error({ maskedTo: maskContact(contact), channel }, 'Portal OTP was not accepted');
    return success;
  } catch (err) {
    logger.error({ maskedTo: maskContact(contact), channel, errorName: err instanceof Error ? err.name : undefined }, 'Portal OTP could not be sent');
    return false;
  }
}

function failuresInWindow(row: { failedCount: number; failedWindowStart: Date }, now: Date) {
  const expired = now.getTime() - row.failedWindowStart.getTime() >= DAY_MS;
  return { expired, count: expired ? 0 : row.failedCount };
}

const codeContext = (userId: string, hash: string) => `${userId}:${hash}`;

const newChallenge = () => randomBytes(24).toString('base64url');
const hashChallenge = (challenge: string) => createHash('sha256').update(challenge).digest('hex');

export interface PortalLogin {
  token: string;
  csrfToken: string;
  contact: PortalContact;
  expiresAt: Date;
}

export const portalOtpService = {
  async request(slug: string, contact: PortalContact): Promise<{ challenge: string }> {
    const provider = await publicBookingService.resolveProvider(slug, 'reachable');
    const paid = isPhoneContact(contact);
    const hash = contactHashOf(contact);
    const challenge = newChallenge();
    if (!hash) return { challenge };
    const now = new Date();

    const outcome = await prisma.$transaction(async (tx): Promise<{ code: string } | { skipped: SkipReason }> => {
      await portalOtpRepository.ensureRow(tx, provider.id, hash, contact.channel, now);
      const row = await portalOtpRepository.lockRow(tx, provider.id, hash);
      if (!row) throw new Error('PortalOtp row missing after ensureRow');

      if (failuresInWindow(row, now).count >= PORTAL_OTP_LIMITS.maxFailuresPerDay) return { skipped: 'failure-cap' };
      if (!canResend(row.lastSentAt, now, PORTAL_OTP_LIMITS.resendCooldownMs)) return { skipped: 'cooldown' };
      const windowExpired = now.getTime() - row.sendWindowStart.getTime() >= HOUR_MS;
      const sendCount = windowExpired ? 0 : row.sendCount;
      if (sendCount >= (paid ? PORTAL_OTP_LIMITS.perPhonePerHour : PORTAL_OTP_LIMITS.perEmailPerHour)) {
        return { skipped: paid ? 'phone-cap' : 'email-cap' };
      }
      const hourAgo = new Date(now.getTime() - HOUR_MS);
      const providerSends = await portalOtpRepository.countSentSince(tx, provider.id, hourAgo);
      if (providerSends >= PORTAL_OTP_LIMITS.perProviderPerHour) return { skipped: 'provider-cap' };
      if (paid) {
        const providerPaid = await portalOtpRepository.countPaidSentSince(tx, hourAgo, provider.id);
        if (providerPaid >= PORTAL_OTP_LIMITS.perProviderPaidPerHour) return { skipped: 'provider-paid-cap' };
        const allPaid = await portalOtpRepository.countPaidSentSince(tx, new Date(now.getTime() - DAY_MS));
        if (allPaid >= config.portal.otpPaidDailyCap) return { skipped: 'paid-daily-cap' };
      }

      const code = generateNumericCode();
      await portalOtpRepository.update(tx, row.id, {
        channel: contact.channel,
        codeHash: hashOneTimeCode(code, codeContext(provider.id, hash), portalSecret()),
        challengeHash: hashChallenge(challenge),
        expiresAt: new Date(now.getTime() + PORTAL_OTP_LIMITS.ttlMs),
        attempts: 0,
        consumedAt: null,
        lastSentAt: now,
        sendWindowStart: windowExpired ? now : row.sendWindowStart,
        sendCount: sendCount + 1,
      });
      return { code };
    });

    if ('skipped' in outcome) {
      const reason = outcome.skipped;
      // Error tracking only receives the message, so the reason goes in it. No contact: this line reaches Sentry.
      if (PAID_CAPS.has(reason)) logger.error({ userId: provider.id, channel: contact.channel, reason }, `Portal OTP paid cap reached: ${reason}`);
      else logger.info({ maskedTo: maskContact(contact), userId: provider.id, reason }, 'Portal OTP not sent');
      return { challenge };
    }
    const sent = await sendPortalOtp(contact, outcome.code, providerDisplayName(provider));
    logger.info({ maskedTo: maskContact(contact), userId: provider.id, sent }, 'Portal OTP issued');
    return { challenge };
  },

  /** `claimed.channel` only says whether it is a phone: the session takes its channel from the row the code was sent on. */
  async verify(slug: string, claimed: PortalContact, code: string, challenge: string): Promise<PortalLogin> {
    const provider = await publicBookingService.resolveProvider(slug, 'reachable');
    const hash = contactHashOf(claimed);
    if (!hash) throw new InvalidPortalOtpError();
    const now = new Date();

    const provenChannel = await prisma.$transaction(async (tx): Promise<Channel | null> => {
      const row = await portalOtpRepository.lockRow(tx, provider.id, hash);
      if (
        !row
        || !safeEqual(hashChallenge(challenge), row.challengeHash)
        || row.consumedAt
        || isCodeExpired(row.expiresAt, now)
        || areAttemptsExhausted(row.attempts, PORTAL_OTP_LIMITS.maxAttempts)
      ) return null;
      const failures = failuresInWindow(row, now);
      if (failures.count >= PORTAL_OTP_LIMITS.maxFailuresPerDay) return null;
      if (!verifyOneTimeCode(code, codeContext(provider.id, hash), portalSecret(), row.codeHash)) {
        await portalOtpRepository.update(tx, row.id, {
          attempts: { increment: 1 },
          failedCount: failures.count + 1,
          failedWindowStart: failures.expired ? now : row.failedWindowStart,
        });
        return null;
      }
      await portalOtpRepository.update(tx, row.id, { consumedAt: now, failedCount: 0 });
      return row.channel;
    });

    if (!provenChannel) {
      logger.info({ maskedTo: maskContact(claimed), userId: provider.id }, 'Portal OTP rejected');
      throw new InvalidPortalOtpError();
    }

    const contact: PortalContact = { channel: provenChannel, value: claimed.value };
    const sid = randomUUID();
    const token = signPortalToken({ userId: provider.id, sid, ...contactClaims(contact) });
    logger.info({ maskedTo: maskContact(contact), userId: provider.id }, 'Portal session started');
    return {
      token,
      csrfToken: createCsrfToken(sid, portalSecret()),
      contact,
      expiresAt: new Date(now.getTime() + PORTAL_SESSION_TTL_SECONDS * 1000),
    };
  },
};
