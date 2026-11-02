import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { requestId } from '../../../src/middlewares/request-id.js';
import { errorHandler } from '../../../src/middlewares/error-handler.js';
import { authenticate } from '../../../src/middlewares/authenticate.js';
import { createPortalSessionRouter, createPublicApiRouter, portalNotFound } from '../../../src/portal/portal-routers.js';
import { portalSecret, signPortalToken } from '../../../src/auth/tokens.js';
import { PORTAL_COOKIE_NAME } from '../../../src/auth/portal-cookie.js';
import { createCsrfToken } from '../../../src/utils/security/csrf.js';
import { DateTime } from 'luxon';
import { ConsentKind } from '../../../generated/prisma/enums.js';
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
  const token = signPortalToken({ userId, email, sid });
  return { cookie: `${PORTAL_COOKIE_NAME}=${token}`, csrf: createCsrfToken(sid, portalSecret()), email, sid };
}

export const PORTAL_ZONE = 'America/Bogota';

/** Start instants (ISO) the public slot engine offers `daysAhead` days from today, in the provider zone. */
export async function slotStarts(provider: LiveProvider, daysAhead = 3): Promise<string[]> {
  const date = DateTime.now().setZone(PORTAL_ZONE).plus({ days: daysAhead }).toISODate()!;
  const { slots } = await publicBookingService.getSlots(provider.slug, { typeId: provider.typeId, from: date, to: date });
  return slots.map((s) => s.startUtc);
}

export function portalBookingBody(provider: LiveProvider, startUtc: string, overrides: Record<string, unknown> = {}) {
  return {
    typeId: provider.typeId,
    locationId: provider.locationId,
    startUtc,
    patientTimezone: 'America/New_York',
    consentAccepted: true,
    patient: { name: 'Lucia', lastName: 'Rojas', phone: '+573001112233' },
    ...overrides,
  };
}

/** An existing (provider-created) patient who already accepted the current policy in the portal. */
export async function createConsentedPatient(userId: string) {
  const patient = await createTestPatient(userId);
  await prisma.patientConsent.create({
    data: { patientId: patient.id, userId, kind: ConsentKind.DATA_PROCESSING, policyVersion: PRIVACY_POLICY_VERSION, acceptedAt: new Date() },
  });
  return patient;
}
