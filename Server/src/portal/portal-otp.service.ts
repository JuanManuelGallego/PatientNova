import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { prisma } from '../utils/prisma/prisma-client.js';
import { logger, maskEmail } from '../utils/api/logger.js';
import { emailHash } from '../utils/encryption/blind-index.js';
import { normalizeEmail } from '../utils/validation/normalize-email.js';
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
import { renderOtpEmail } from '../brevo/email-templates.js';
import { providerDisplayName, publicBookingService } from '../public-booking/public-booking.service.js';
import { portalOtpRepository } from './portal-otp.repository.js';
import { InvalidPortalOtpError } from './portal-otp.errors.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const PORTAL_OTP_LIMITS = {
  ttlMs: ONE_TIME_CODE_DEFAULTS.ttlMs,
  maxAttempts: ONE_TIME_CODE_DEFAULTS.maxAttempts,
  resendCooldownMs: ONE_TIME_CODE_DEFAULTS.resendCooldownMs,
  perEmailPerHour: 5,
  perProviderPerHour: 100,
  maxFailuresPerDay: 15,
} as const;

type SkipReason = 'failure-cap' | 'cooldown' | 'email-cap' | 'provider-cap';

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
  email: string;
  expiresAt: Date;
}

export const portalOtpService = {
  async request(slug: string, rawEmail: string): Promise<{ challenge: string }> {
    const provider = await publicBookingService.resolveProvider(slug);
    const email = normalizeEmail(rawEmail);
    const hash = emailHash(email);
    const challenge = newChallenge();
    if (!hash) return { challenge };
    const now = new Date();

    const outcome = await prisma.$transaction(async (tx): Promise<{ code: string } | { skipped: SkipReason }> => {
      await portalOtpRepository.ensureRow(tx, provider.id, hash, now);
      const row = await portalOtpRepository.lockRow(tx, provider.id, hash);
      if (!row) throw new Error('PortalOtp row missing after ensureRow');

      if (failuresInWindow(row, now).count >= PORTAL_OTP_LIMITS.maxFailuresPerDay) return { skipped: 'failure-cap' };
      if (!canResend(row.lastSentAt, now, PORTAL_OTP_LIMITS.resendCooldownMs)) return { skipped: 'cooldown' };
      const windowExpired = now.getTime() - row.sendWindowStart.getTime() >= HOUR_MS;
      const sendCount = windowExpired ? 0 : row.sendCount;
      if (sendCount >= PORTAL_OTP_LIMITS.perEmailPerHour) return { skipped: 'email-cap' };
      const providerSends = await portalOtpRepository.countSentSince(tx, provider.id, new Date(now.getTime() - HOUR_MS));
      if (providerSends >= PORTAL_OTP_LIMITS.perProviderPerHour) return { skipped: 'provider-cap' };

      const code = generateNumericCode();
      await portalOtpRepository.update(tx, row.id, {
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
      logger.info({ maskedEmail: maskEmail(email), userId: provider.id, reason: outcome.skipped }, 'Portal OTP not sent');
      return { challenge };
    }
    const { sent } = await sendTransactionalEmail(email, renderOtpEmail({
      code: outcome.code,
      providerName: providerDisplayName(provider),
      ttlMinutes: Math.round(PORTAL_OTP_LIMITS.ttlMs / 60_000),
    }));
    logger.info({ maskedEmail: maskEmail(email), userId: provider.id, sent }, 'Portal OTP issued');
    return { challenge };
  },

  async verify(slug: string, rawEmail: string, code: string, challenge: string): Promise<PortalLogin> {
    const provider = await publicBookingService.resolveProvider(slug);
    const email = normalizeEmail(rawEmail);
    const hash = emailHash(email);
    if (!hash) throw new InvalidPortalOtpError();
    const now = new Date();

    const valid = await prisma.$transaction(async (tx) => {
      const row = await portalOtpRepository.lockRow(tx, provider.id, hash);
      if (
        !row
        || !safeEqual(hashChallenge(challenge), row.challengeHash)
        || row.consumedAt
        || isCodeExpired(row.expiresAt, now)
        || areAttemptsExhausted(row.attempts, PORTAL_OTP_LIMITS.maxAttempts)
      ) return false;
      const failures = failuresInWindow(row, now);
      if (failures.count >= PORTAL_OTP_LIMITS.maxFailuresPerDay) return false;
      if (!verifyOneTimeCode(code, codeContext(provider.id, hash), portalSecret(), row.codeHash)) {
        await portalOtpRepository.update(tx, row.id, {
          attempts: { increment: 1 },
          failedCount: failures.count + 1,
          failedWindowStart: failures.expired ? now : row.failedWindowStart,
        });
        return false;
      }
      await portalOtpRepository.update(tx, row.id, { consumedAt: now, failedCount: 0 });
      return true;
    });

    if (!valid) {
      logger.info({ maskedEmail: maskEmail(email), userId: provider.id }, 'Portal OTP rejected');
      throw new InvalidPortalOtpError();
    }

    const sid = randomUUID();
    const token = signPortalToken({ userId: provider.id, email, sid });
    logger.info({ maskedEmail: maskEmail(email), userId: provider.id }, 'Portal session started');
    return {
      token,
      csrfToken: createCsrfToken(sid, portalSecret()),
      email,
      expiresAt: new Date(now.getTime() + PORTAL_SESSION_TTL_SECONDS * 1000),
    };
  },
};
