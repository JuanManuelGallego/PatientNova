import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { bookingSettingsRouter } from '../../../src/booking-settings/booking-settings.routes.js';
import { locationRouter } from '../../../src/locations/location.routes.js';
import { appointmentTypeRouter } from '../../../src/appointment-types/appointment-type.routes.js';
import { EntityType } from '../../../generated/prisma/enums.ts';
import {
  createTestUser,
  createTestLocation,
  createTestAppointmentType,
  invokeRoute,
  unique,
} from '../helpers.js';

let userId: string;

beforeEach(async () => {
  const user = await createTestUser();
  userId = user.id;
});

function reqFor(id: string, extra: Record<string, unknown> = {}) {
  return { user: { id, timezone: 'America/Bogota' }, ip: '127.0.0.1', ...extra };
}

const patchSettings = (body: Record<string, unknown>, id = userId) =>
  invokeRoute(bookingSettingsRouter, 'patch', '/settings', reqFor(id, { body }));
const putAvailability = (rules: unknown[], id = userId) =>
  invokeRoute(bookingSettingsRouter, 'put', '/availability', reqFor(id, { body: { rules } }));

const MONDAY_MORNING = { weekday: 1, startMinute: 540, endMinute: 720 };

async function makeReady(id = userId) {
  await prisma.user.update({ where: { id }, data: { bookingSlug: unique('dra').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40).replace(/-+$/, '') } });
  await prisma.availabilityRule.create({ data: { userId: id, ...MONDAY_MORNING } });
  const type = await createTestAppointmentType(id);
  await prisma.appointmentType.update({ where: { id: type.id }, data: { bookableOnline: true } });
  const location = await createTestLocation(id);
  await prisma.appointmentLocation.update({ where: { id: location.id }, data: { bookableOnline: true } });
}

describe('booking settings routes (integration)', () => {
  it('GET /settings returns defaults and an empty readiness checklist', async () => {
    const res = await invokeRoute(bookingSettingsRouter, 'get', '/settings', reqFor(userId));
    expect(res.statusCode).toBe(200);
    expect((res.body as any).data).toMatchObject({
      bookingSlug: null,
      bookingUrl: null,
      bookingEnabled: false,
      bookingApprovalMode: 'AUTO_CONFIRM',
      slotIntervalMinutes: 30,
      bufferMinutes: 0,
      minLeadMinutes: 120,
      maxHorizonDays: 60,
      readiness: { hasSlug: false, hasAvailability: false, hasBookableType: false, hasBookableLocation: false },
    });
  });

  it('PATCH /settings normalizes and stores the slug, exposes the booking URL and audits', async () => {
    const res = await patchSettings({ bookingSlug: '  Dra-Maria ', bufferMinutes: 10 });
    expect(res.statusCode).toBe(200);
    expect((res.body as any).data.bookingSlug).toBe('dra-maria');
    expect((res.body as any).data.bookingUrl).toMatch(/\/book\/dra-maria$/);

    const stored = await prisma.user.findUnique({ where: { id: userId } });
    expect(stored!.bookingSlug).toBe('dra-maria');
    expect(stored!.bufferMinutes).toBe(10);

    const audit = await prisma.auditLog.findFirst({ where: { entityType: EntityType.USER, entityId: userId } });
    expect(audit!.affectedFields.sort()).toEqual([ 'bookingSlug', 'bufferMinutes' ]);
  });

  it('PATCH /settings returns 409 when another provider owns the slug', async () => {
    const other = await createTestUser();
    expect((await patchSettings({ bookingSlug: 'compartido' }, other.id)).statusCode).toBe(200);
    const res = await patchSettings({ bookingSlug: 'compartido' });
    expect(res.statusCode).toBe(409);
    expect(JSON.stringify(res.body)).not.toContain(other.email);
  });

  it('PATCH /settings rejects reserved and malformed slugs with 400', async () => {
    expect((await patchSettings({ bookingSlug: 'login' })).statusCode).toBe(400);
    expect((await patchSettings({ bookingSlug: 'a--b' })).statusCode).toBe(400);
    expect((await patchSettings({ slotIntervalMinutes: 7 })).statusCode).toBe(400);
  });

  it('PATCH /settings refuses to enable until ready (422), then succeeds', async () => {
    const notReady = await patchSettings({ bookingEnabled: true });
    expect(notReady.statusCode).toBe(422);
    expect(JSON.stringify(notReady.body)).toContain('availability');

    await makeReady();
    const res = await patchSettings({ bookingEnabled: true });
    expect(res.statusCode).toBe(200);
    expect((res.body as any).data.bookingEnabled).toBe(true);
  });

  it('virtual, inactive or deleted locations and types do not count as bookable', async () => {
    await prisma.user.update({ where: { id: userId }, data: { bookingSlug: 'listo' } });
    await prisma.availabilityRule.create({ data: { userId, ...MONDAY_MORNING } });
    const virtual = await createTestLocation(userId, { isVirtual: true });
    await prisma.appointmentLocation.update({ where: { id: virtual.id }, data: { bookableOnline: true } });
    const type = await createTestAppointmentType(userId);
    await prisma.appointmentType.update({ where: { id: type.id }, data: { bookableOnline: true, isDeleted: true } });

    const res = await invokeRoute(bookingSettingsRouter, 'get', '/settings', reqFor(userId));
    expect((res.body as any).data.readiness).toEqual({ hasSlug: true, hasAvailability: true, hasBookableType: false, hasBookableLocation: false });
  });

  it('clearing the slug disables booking', async () => {
    await makeReady();
    await patchSettings({ bookingEnabled: true });
    const res = await patchSettings({ bookingSlug: null });
    expect(res.statusCode).toBe(200);
    expect((res.body as any).data).toMatchObject({ bookingSlug: null, bookingEnabled: false });
  });

  it('GET /slug-suggestion derives a free slug from the display name', async () => {
    const other = await createTestUser();
    await prisma.user.update({ where: { id: other.id }, data: { bookingSlug: 'test-user' } });
    const res = await invokeRoute(bookingSettingsRouter, 'get', '/slug-suggestion', reqFor(userId));
    expect(res.statusCode).toBe(200);
    expect((res.body as any).data.slug).toBe('test-user-2');
  });
});

describe('availability routes (integration)', () => {
  it('PUT /availability replaces the whole week and GET returns it sorted', async () => {
    await putAvailability([ { weekday: 3, startMinute: 840, endMinute: 1020 }, MONDAY_MORNING ]);
    const res = await putAvailability([
      { weekday: 2, startMinute: 780, endMinute: 900 },
      { weekday: 2, startMinute: 480, endMinute: 780 },
    ]);
    expect(res.statusCode).toBe(200);

    const get = await invokeRoute(bookingSettingsRouter, 'get', '/availability', reqFor(userId));
    expect((get.body as any).data).toEqual({
      timezone: 'America/Bogota',
      rules: [
        { weekday: 2, startMinute: 480, endMinute: 780 },
        { weekday: 2, startMinute: 780, endMinute: 900 },
      ],
    });
    expect(await prisma.availabilityRule.count({ where: { userId } })).toBe(2);
  });

  it('PUT /availability rejects overlapping windows with 400 and keeps the old week', async () => {
    await putAvailability([ MONDAY_MORNING ]);
    const res = await putAvailability([ { weekday: 1, startMinute: 540, endMinute: 660 }, { weekday: 1, startMinute: 600, endMinute: 720 } ]);
    expect(res.statusCode).toBe(400);
    const rules = await prisma.availabilityRule.findMany({ where: { userId } });
    expect(rules).toHaveLength(1);
  });

  it('PUT /availability refuses an empty week while booking is enabled (422)', async () => {
    await makeReady();
    await patchSettings({ bookingEnabled: true });
    const res = await putAvailability([]);
    expect(res.statusCode).toBe(422);
    expect(await prisma.availabilityRule.count({ where: { userId } })).toBe(1);
  });

  it('PUT /availability writes one audit row with before/after', async () => {
    await putAvailability([ MONDAY_MORNING ]);
    const audits = await prisma.auditLog.findMany({ where: { entityType: EntityType.USER, entityId: userId } });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.affectedFields).toEqual([ 'availability' ]);
  });

  it('is tenant-scoped: one provider never sees or replaces another provider rules', async () => {
    const other = await createTestUser();
    await putAvailability([ MONDAY_MORNING ], other.id);
    await putAvailability([ { weekday: 5, startMinute: 600, endMinute: 660 } ]);

    const mine = await invokeRoute(bookingSettingsRouter, 'get', '/availability', reqFor(userId));
    expect((mine.body as any).data.rules).toEqual([ { weekday: 5, startMinute: 600, endMinute: 660 } ]);
    const theirs = await prisma.availabilityRule.findMany({ where: { userId: other.id } });
    expect(theirs.map((r) => r.weekday)).toEqual([ 1 ]);
  });
});

describe('bookable toggles (integration)', () => {
  it('locations: bookableOnline is stored on create and update', async () => {
    const res = await invokeRoute(locationRouter, 'post', '/', reqFor(userId, {
      body: { name: unique('Consultorio'), address: 'Calle 1', instructions: 'Piso 2', bookableOnline: true },
    }));
    expect(res.statusCode).toBe(201);
    const id = (res.body as any).data.id;
    expect((await prisma.appointmentLocation.findUnique({ where: { id } }))!.bookableOnline).toBe(true);

    const upd = await invokeRoute(locationRouter, 'patch', `/${id}`, reqFor(userId, { params: { id }, body: { bookableOnline: false } }));
    expect(upd.statusCode).toBe(200);
    expect((await prisma.appointmentLocation.findUnique({ where: { id } }))!.bookableOnline).toBe(false);
  });

  it('locations: virtual + bookable is rejected on create', async () => {
    const res = await invokeRoute(locationRouter, 'post', '/', reqFor(userId, {
      body: { name: unique('Virtual'), isVirtual: true, bookableOnline: true },
    }));
    expect(res.statusCode).toBe(400);
  });

  it('locations: marking a virtual location bookable, or a bookable one virtual, is rejected', async () => {
    const virtual = await createTestLocation(userId, { isVirtual: true });
    const a = await invokeRoute(locationRouter, 'patch', `/${virtual.id}`, reqFor(userId, { params: { id: virtual.id }, body: { bookableOnline: true } }));
    expect(a.statusCode).toBe(400);

    const inPerson = await createTestLocation(userId);
    await prisma.appointmentLocation.update({ where: { id: inPerson.id }, data: { bookableOnline: true } });
    const b = await invokeRoute(locationRouter, 'patch', `/${inPerson.id}`, reqFor(userId, { params: { id: inPerson.id }, body: { isVirtual: true } }));
    expect(b.statusCode).toBe(400);
    expect((await prisma.appointmentLocation.findUnique({ where: { id: inPerson.id } }))!.isVirtual).toBe(false);
  });

  it('appointment types: bookableOnline is stored on create and update', async () => {
    const res = await invokeRoute(appointmentTypeRouter, 'post', '/', reqFor(userId, {
      body: { name: unique('Primera vez'), defaultDuration: 50, bookableOnline: true },
    }));
    expect(res.statusCode).toBe(201);
    const id = (res.body as any).data.id;
    expect((await prisma.appointmentType.findUnique({ where: { id } }))!.bookableOnline).toBe(true);

    const upd = await invokeRoute(appointmentTypeRouter, 'patch', `/${id}`, reqFor(userId, { params: { id }, body: { bookableOnline: false } }));
    expect(upd.statusCode).toBe(200);
    expect((await prisma.appointmentType.findUnique({ where: { id } }))!.bookableOnline).toBe(false);
  });
});
