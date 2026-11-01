import express from 'express';
import helmet from 'helmet';
import request from 'supertest';
import { DateTime } from 'luxon';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import { requestId } from '../../../src/middlewares/request-id.js';
import { errorHandler } from '../../../src/middlewares/error-handler.js';
import { createPublicApiRouter, portalNotFound } from '../../../src/portal/portal-routers.js';
import { AdminStatus, AppointmentStatus } from '../../../generated/prisma/enums.ts';
import {
  createTestAppointmentType,
  createTestLocation,
  createTestPatient,
  createTestUser,
  unique,
} from '../helpers.js';

const ALLOWED = 'http://localhost:3000';
const TZ = 'America/Bogota';
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

// Wired like app.ts with ENABLE_PORTAL on (the real app reads the flag at import, and it is off in tests).
function buildApp() {
  const a = express();
  a.set('trust proxy', 1);
  a.use(requestId);
  a.use(helmet());
  a.use('/v1/public', createPublicApiRouter(), portalNotFound);
  a.use(errorHandler);
  return a;
}

let app: express.Express;
const portal = config.portal as { patientEnabled: boolean };
const portalWas = portal.patientEnabled;
beforeAll(() => { portal.patientEnabled = true; });
afterAll(() => { portal.patientEnabled = portalWas; });
// A fresh app per test: the public limiter is in-memory per router instance (60/min).
beforeEach(() => { app = buildApp(); });

const get = (path: string) => request(app).get(`/v1/public/providers${path}`).set('Origin', ALLOWED);

interface Provider {
  id: string;
  slug: string;
  typeId: string;
  locationId: string;
}

async function createLiveProvider(): Promise<Provider> {
  const user = await createTestUser();
  const slug = unique('dra').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  await prisma.user.update({
    where: { id: user.id },
    data: { bookingSlug: slug, bookingEnabled: true, jobTitle: 'Psicóloga', minLeadMinutes: 0, slotIntervalMinutes: 30, timezone: TZ },
  });
  await prisma.availabilityRule.create({ data: { userId: user.id, weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 } });
  const type = await createTestAppointmentType(user.id);
  await prisma.appointmentType.update({ where: { id: type.id }, data: { bookableOnline: true, defaultPrice: 120000 } });
  const location = await createTestLocation(user.id);
  await prisma.appointmentLocation.update({
    where: { id: location.id },
    data: { bookableOnline: true, address: 'Calle 1', instructions: 'Piso 2' },
  });
  return { id: user.id, slug, typeId: type.id, locationId: location.id };
}

// A Monday at least a week ahead, in the provider's zone.
const monday = DateTime.now().setZone(TZ).plus({ weeks: 1 }).startOf('week');
const day = monday.toISODate()!;
const at = (hhmm: string) => {
  const [ h, m ] = hhmm.split(':').map(Number);
  return monday.set({ hour: h!, minute: m! }).toJSDate();
};
const iso = (hhmm: string) => at(hhmm).toISOString();

async function slotStarts(p: Provider, extra = ''): Promise<string[]> {
  const res = await get(`/${p.slug}/slots?typeId=${p.typeId}&from=${day}&to=${day}${extra}`);
  expect(res.status).toBe(200);
  return res.body.data.slots.map((s: { startUtc: string }) => s.startUtc);
}

async function appointment(p: Provider, from: string, to: string, extra: Record<string, unknown> = {}) {
  const patient = await createTestPatient(p.id);
  return prisma.appointment.create({
    data: { userId: p.id, patientId: patient.id, typeId: p.typeId, price: 1, startAt: at(from), endAt: at(to), ...extra },
  });
}

const ALL = [ '09:00', '09:30', '10:00', '10:30', '11:00' ];

describe('public provider resolution', () => {
  it('answers unknown, malformed, disabled, not-ready, inactive and deleted providers with the same 404', async () => {
    const disabled = await createLiveProvider();
    await prisma.user.update({ where: { id: disabled.id }, data: { bookingEnabled: false } });
    const notReady = await createLiveProvider();
    await prisma.appointmentType.update({ where: { id: notReady.typeId }, data: { bookableOnline: false } });
    const inactive = await createLiveProvider();
    await prisma.user.update({ where: { id: inactive.id }, data: { status: AdminStatus.INACTIVE } });
    const deleted = await createLiveProvider();
    await prisma.user.update({ where: { id: deleted.id }, data: { deletedAt: new Date(), isDeleted: true } });

    const slugs = [ 'no-such-provider', 'BAD SLUG!!', 'login', disabled.slug, notReady.slug, inactive.slug, deleted.slug ];
    for (const slug of slugs) {
      for (const path of [ '', '/slots?typeId=00000000-0000-4000-8000-000000000000&from=2030-01-07&to=2030-01-07', '/avatar' ]) {
        const res = await get(`/${encodeURIComponent(slug)}${path}`);
        expect(res.status, `${slug}${path}`).toBe(404);
        expect(res.body).toEqual({ success: false, error: 'Provider not found', requestId: expect.any(String), timestamp: expect.any(String) });
      }
    }
  });

  it('normalizes the slug case like the booking settings do', async () => {
    const p = await createLiveProvider();
    expect((await get(`/${p.slug.toUpperCase()}`)).status).toBe(200);
  });
});

describe('GET /v1/public/providers/:slug', () => {
  it('returns exactly the allow-listed fields', async () => {
    const p = await createLiveProvider();
    const res = await get(`/${p.slug}`);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data).toEqual({
      displayName: 'Test User',
      jobTitle: 'Psicóloga',
      hasAvatar: false,
      hasLogo: false,
      timezone: TZ,
      lastBookableDate: DateTime.now().setZone(TZ).plus({ days: 59 }).toISODate(),
      types: [ { id: p.typeId, name: expect.any(String), description: null, durationMinutes: 60, price: 120000 } ],
      locations: [ { id: p.locationId, name: expect.any(String), address: 'Calle 1' } ],
    });
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(p.id);
    expect(text).not.toContain('Piso 2');
  });

  it('falls back to first and last name without a display name', async () => {
    const p = await createLiveProvider();
    await prisma.user.update({ where: { id: p.id }, data: { displayName: '  ' } });
    expect((await get(`/${p.slug}`)).body.data.displayName).toBe('Test User');
  });

  it('hides non-bookable, inactive, deleted and virtual types and locations', async () => {
    const p = await createLiveProvider();
    const hiddenTypes = await Promise.all([ {}, { isActive: false }, { isDeleted: true } ].map(async (data, i) => {
      const t = await createTestAppointmentType(p.id);
      return prisma.appointmentType.update({ where: { id: t.id }, data: { bookableOnline: i > 0, ...data } });
    }));
    const hiddenLocations = await Promise.all([ {}, { isActive: false }, { isDeleted: true }, { isVirtual: true } ].map(async (data, i) => {
      const l = await createTestLocation(p.id);
      return prisma.appointmentLocation.update({ where: { id: l.id }, data: { bookableOnline: i > 0, ...data } });
    }));
    const body = (await get(`/${p.slug}`)).body.data;
    expect(body.types.map((t: { id: string }) => t.id)).toEqual([ p.typeId ]);
    expect(body.locations.map((l: { id: string }) => l.id)).toEqual([ p.locationId ]);
    expect(hiddenTypes.length + hiddenLocations.length).toBe(7);
  });

  it('carries no cookies and no credentialed CORS', async () => {
    const p = await createLiveProvider();
    const res = await get(`/${p.slug}`);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });
});

describe('GET /v1/public/providers/:slug/avatar and /logo', () => {
  it('serves allow-listed images as bytes, loadable cross-origin', async () => {
    const p = await createLiveProvider();
    await prisma.user.update({ where: { id: p.id }, data: { avatar: PNG, logo: 'data:image/webp;base64,UklGRg==' } });
    expect((await get(`/${p.slug}`)).body.data).toMatchObject({ hasAvatar: true, hasLogo: true });

    const avatar = await get(`/${p.slug}/avatar`);
    expect(avatar.status).toBe(200);
    expect(avatar.headers['content-type']).toBe('image/png');
    expect(avatar.headers['x-content-type-options']).toBe('nosniff');
    expect(avatar.headers['content-disposition']).toBe('inline');
    expect(avatar.headers['cache-control']).toBe('public, max-age=300');
    expect(avatar.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(Buffer.from(avatar.body).equals(Buffer.from('iVBORw0KGgo=', 'base64'))).toBe(true);
    expect((await get(`/${p.slug}/logo`)).headers['content-type']).toBe('image/webp');
  });

  it('answers 404 when unset or not an allowed image type', async () => {
    const p = await createLiveProvider();
    expect((await get(`/${p.slug}/avatar`)).status).toBe(404);
    await prisma.user.update({ where: { id: p.id }, data: { avatar: 'data:image/svg+xml;base64,PHN2Zy8+', logo: 'not a data url' } });
    expect((await get(`/${p.slug}/avatar`)).status).toBe(404);
    expect((await get(`/${p.slug}/logo`)).status).toBe(404);
    expect((await get(`/${p.slug}`)).body.data).toMatchObject({ hasAvatar: false, hasLogo: false });
  });
});

describe('GET /v1/public/providers/:slug/slots', () => {
  it('lists the grid in the provider zone with the type duration, ignoring a client duration', async () => {
    const p = await createLiveProvider();
    const res = await get(`/${p.slug}/slots?typeId=${p.typeId}&from=${day}&to=${day}&duration=15`);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data).toEqual({
      timezone: TZ,
      slots: ALL.map((t) => ({ startUtc: iso(t), endUtc: new Date(at(t).getTime() + 60 * 60_000).toISOString() })),
    });
  });

  it('excludes active appointments (with the buffer) and blocked time, not cancelled or deleted ones', async () => {
    const p = await createLiveProvider();
    await appointment(p, '09:00', '09:30', { status: AppointmentStatus.CANCELLED });
    await appointment(p, '09:00', '09:30', { isDeleted: true, deletedAt: new Date() });
    expect(await slotStarts(p)).toEqual(ALL.map(iso));

    await appointment(p, '11:00', '11:30', { status: AppointmentStatus.CONFIRMED });
    expect(await slotStarts(p)).toEqual([ '09:00', '09:30', '10:00' ].map(iso));

    await prisma.user.update({ where: { id: p.id }, data: { bufferMinutes: 30 } });
    expect(await slotStarts(p)).toEqual([ '09:00', '09:30' ].map(iso));

    // Blocked time is not widened by the buffer: 09:30 still fits after a 09:15-09:20 block.
    await prisma.blockedTime.create({ data: { userId: p.id, startTimeUtc: at('09:15'), endTimeUtc: at('09:20') } });
    expect(await slotStarts(p)).toEqual([ '09:30' ].map(iso));
  });

  it("keeps two providers' calendars independent", async () => {
    const a = await createLiveProvider();
    const b = await createLiveProvider();
    await appointment(a, '09:00', '12:00');
    expect(await slotStarts(a)).toEqual([]);
    expect(await slotStarts(b)).toEqual(ALL.map(iso));
  });

  it("answers 404 for another provider's type or a non-bookable one", async () => {
    const a = await createLiveProvider();
    const b = await createLiveProvider();
    const foreign = await get(`/${a.slug}/slots?typeId=${b.typeId}&from=${day}&to=${day}`);
    expect(foreign.status).toBe(404);
    expect(foreign.body.error).toBe('Appointment type not found');

    const hidden = await createTestAppointmentType(a.id);
    expect((await get(`/${a.slug}/slots?typeId=${hidden.id}&from=${day}&to=${day}`)).status).toBe(404);
  });

  it('rejects bad dates, reversed ranges and ranges over 31 days with 400', async () => {
    const p = await createLiveProvider();
    const q = (from: string, to: string, typeId = p.typeId) => get(`/${p.slug}/slots?typeId=${typeId}&from=${from}&to=${to}`);
    expect((await q('2030-01-01', '2030-02-01')).status).toBe(400); // 32 days
    expect((await q('2030-01-01', '2030-01-31')).status).toBe(200);
    expect((await q('2030-01-02', '2030-01-01')).status).toBe(400);
    expect((await q('2030-02-30', '2030-03-01')).status).toBe(400);
    expect((await q('2030-1-5', '2030-01-06')).status).toBe(400);
    expect((await q('2030-01-01', '2030-01-01', 'not-a-uuid')).status).toBe(400);
    expect((await get(`/${p.slug}/slots?from=2030-01-01&to=2030-01-01`)).status).toBe(400);
  });
});
