import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { createHash, randomUUID } from 'node:crypto';
import { prisma, type TransactionClient } from '../../../src/utils/prisma/prisma-client.js';
import { bookingRequestService, type NewBookingRequest } from '../../../src/booking-requests/booking-request.service.js';
import { bookingRequestRepository } from '../../../src/booking-requests/booking-request.repository.js';
import { issueRequestToken } from '../../../src/booking-requests/request-token.js';
import { bookingConfirmationService } from '../../../src/portal/booking-confirmation.service.js';
import { withProviderLock } from '../../../src/utils/prisma/provider-lock.js';
import { holdExpiry } from '../../../src/booking-requests/booking-request.constants.js';
import { requestId } from '../../../src/middlewares/request-id.js';
import { errorHandler } from '../../../src/middlewares/error-handler.js';
import { authenticate } from '../../../src/middlewares/authenticate.js';
import { createPortalSessionRouter, createPublicApiRouter, portalNotFound } from '../../../src/portal/portal-routers.js';
import { portalSecret, signPortalToken } from '../../../src/auth/tokens.js';
import { PORTAL_COOKIE_NAME } from '../../../src/auth/portal-cookie.js';
import { createCsrfToken } from '../../../src/utils/security/csrf.js';
import { DateTime } from 'luxon';
import { BookingRequestKind, Channel, ConsentKind } from '../../../generated/prisma/enums.js';
import { publicBookingService } from '../../../src/public-booking/public-booking.service.js';
import { PRIVACY_POLICY_VERSION } from '../../../src/portal/privacy-policy.js';
import { createTestAppointmentType, createTestLocation, createTestPatient, createTestUser } from '../helpers.js';

export const ALLOWED_ORIGIN = 'http://localhost:3000';

export function buildPortalApp(): express.Express {
  const a = express();
  a.set('trust proxy', 1);
  a.use(requestId);
  a.use(helmet());
  a.use('/v1/public', createPublicApiRouter(), portalNotFound);
  a.use('/v1/portal', createPortalSessionRouter(), portalNotFound);
  a.get('/v1/users/me', cookieParser(), authenticate, (_req, res) => { res.json({ ok: true }); });
  a.use(errorHandler);
  return a;
}

export interface LiveProvider {
  id: string;
  slug: string;
  typeId: string;
  locationId: string;
}

let seq = 0;

export async function createLiveProvider(opts: { bufferMinutes?: number; price?: number } = {}): Promise<LiveProvider> {
  const user = await createTestUser();
  const slug = `dra-portal-${Date.now()}-${++seq}`.slice(0, 40);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      bookingSlug: slug,
      bookingEnabled: true,
      legalName: 'Consultorio Prueba S.A.S.', privacyContact: 'privacidad@test.local', contactHours: 'Lunes a viernes, 8:00 a 17:00', publicPhone: '+573001234567',
      slotIntervalMinutes: 60,
      bufferMinutes: opts.bufferMinutes ?? 0,
      minLeadMinutes: 0,
      maxHorizonDays: 30,
    },
  });
  await prisma.availabilityRule.createMany({
    data: [ 1, 2, 3, 4, 5, 6, 7 ].map((weekday) => ({ userId: user.id, weekday, startMinute: 480, endMinute: 1080 })),
  });
  const type = await createTestAppointmentType(user.id);
  await prisma.appointmentType.update({
    where: { id: type.id },
    data: { bookableOnline: true, defaultPrice: opts.price ?? 120000 },
  });
  const location = await createTestLocation(user.id);
  await prisma.appointmentLocation.update({ where: { id: location.id }, data: { bookableOnline: true } });
  return { id: user.id, slug, typeId: type.id, locationId: location.id };
}

export interface TestSession { cookie: string; csrf: string; email: string; sid: string }

export function sessionFor(userId: string, email: string): TestSession {
  const sid = `sid-${++seq}`;
  const token = signPortalToken({ userId, email, sid, channel: Channel.EMAIL });
  return { cookie: `${PORTAL_COOKIE_NAME}=${token}`, csrf: createCsrfToken(sid, portalSecret()), email, sid };
}

export function phoneSessionFor(userId: string, phone: string, channel: Channel = Channel.WHATSAPP): TestSession {
  const sid = `sid-${++seq}`;
  const token = signPortalToken({ userId, phone, sid, channel });
  return { cookie: `${PORTAL_COOKIE_NAME}=${token}`, csrf: createCsrfToken(sid, portalSecret()), email: '', sid };
}

/** POST on a session route with the exact Origin, the session cookie and its CSRF token (`csrf: null` omits it). */
export function portalPost(
  app: express.Express,
  path: string,
  s: TestSession,
  body?: object,
  opts: { csrf?: string | null; origin?: string } = {},
) {
  const req = request(app).post(path).set('Origin', opts.origin ?? ALLOWED_ORIGIN).set('Cookie', s.cookie);
  const csrf = opts.csrf === undefined ? s.csrf : opts.csrf;
  if (csrf !== null) req.set('X-CSRF-Token', csrf);
  return body ? req.send(body) : req.send();
}

export const PORTAL_ZONE = 'America/Bogota';

/** Start instants (ISO) the public slot engine offers `daysAhead` days from today, in the provider zone. */
export async function slotStarts(provider: LiveProvider, daysAhead = 3): Promise<string[]> {
  const date = DateTime.now().setZone(PORTAL_ZONE).plus({ days: daysAhead }).toISODate()!;
  const { slots } = await publicBookingService.getSlots(provider.slug, { typeId: provider.typeId, from: date, to: date });
  return slots.map((s) => s.startUtc);
}

/** An existing (provider-created) patient who already accepted the current policy in the portal. */
export async function createConsentedPatient(userId: string) {
  const patient = await createTestPatient(userId);
  await prisma.patientConsent.create({
    data: { patientId: patient.id, userId, kind: ConsentKind.DATA_PROCESSING, policyVersion: PRIVACY_POLICY_VERSION, acceptedAt: new Date() },
  });
  return patient;
}

export async function createPendingRequestWithin(tx: TransactionClient, userId: string, input: NewBookingRequest, now: Date = new Date()) {
  const { request, expiredIds } = await bookingRequestService.createUnconfirmedWithin(tx, userId, {
    ...input,
    confirmTokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
    releaseTokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
  }, now);
  await bookingRequestRepository.markConfirmedPending(
    request.id,
    { kind: input.kind ?? BookingRequestKind.NEW, confirmedAt: now, holdExpiresAt: holdExpiry(now, input.startAt) },
    tx,
  );
  return { request: await tx.bookingRequest.findUniqueOrThrow({ where: { id: request.id } }), expiredIds };
}

export interface ConfirmedBookingOptions {
  email?: string;
  phone?: string;
  channel?: Channel;
  patient?: { name: string; lastName: string; phone?: string | null };
  typeId?: string;
  locationId?: string;
  patientTimezone?: string;
}

export async function bookViaConfirmation(provider: LiveProvider, startUtc: string, opts: ConfirmedBookingOptions = {}) {
  const email = opts.email ?? (opts.phone ? undefined : `paciente-${Date.now()}-${++seq}@test.local`);
  const start = new Date(startUtc);
  const type = await prisma.appointmentType.findUniqueOrThrow({ where: { id: opts.typeId ?? provider.typeId } });
  const confirm = issueRequestToken();
  const release = issueRequestToken();
  const patient = opts.patient ?? { name: 'Lucia', lastName: 'Rojas', phone: email ? '+573001112233' : null };
  const requestId = await prisma.$transaction(async (tx) => {
    await withProviderLock(tx, provider.id);
    const { request } = await bookingRequestService.createUnconfirmedWithin(tx, provider.id, {
      contactChannel: email ? Channel.EMAIL : (opts.channel ?? Channel.WHATSAPP),
      email: email ?? null,
      verifiedPhone: email ? null : opts.phone!,
      name: patient.name,
      lastName: patient.lastName,
      phone: patient.phone || null,
      typeId: opts.typeId ?? provider.typeId,
      locationId: opts.locationId ?? provider.locationId,
      startAt: start,
      endAt: new Date(start.getTime() + type.defaultDuration * 60_000),
      patientTimezone: opts.patientTimezone ?? 'America/New_York',
      policyVersion: PRIVACY_POLICY_VERSION,
      consentAcceptedAt: new Date(),
      consentIp: '203.0.113.9',
      consentUserAgent: 'vitest',
      confirmTokenHash: confirm.hash,
      releaseTokenHash: release.hash,
    }, new Date());
    return request.id;
  });
  const view = await bookingConfirmationService.confirm(confirm.token, { ipAddress: '203.0.113.9', userAgent: 'vitest' });
  const row = await prisma.bookingRequest.findUniqueOrThrow({ where: { id: requestId } });
  return { requestId, view, row, appointmentId: row.appointmentId, email };
}
