import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { AdminRole } from '../../../generated/prisma/client.ts';
import {
  appointmentTimeRange,
  createTestAppointmentType,
  createTestLocation,
  createTestPatient,
  createTestToken,
  createTestUser,
  futureDate,
} from '../helpers.js';

interface RestoreTarget {
  path: string;
  seed: (userId: string) => Promise<{ id: string }>;
  read: (id: string) => Promise<{ isDeleted: boolean } | null>;
}

const targets = [
  {
    path: 'patients',
    seed: (userId) => prisma.patient.create({ data: { userId, name: 'Ana', lastName: 'Lopez', isDeleted: true } }),
    read: (id) => prisma.patient.findUnique({ where: { id } }),
  },
  {
    path: 'appointments',
    seed: async (userId) => {
      const patient = await createTestPatient(userId);
      const location = await createTestLocation(userId);
      const type = await createTestAppointmentType(userId);
      const { start, end } = appointmentTimeRange();
      return prisma.appointment.create({
        data: { userId, patientId: patient.id, locationId: location.id, typeId: type.id, startAt: start, endAt: end, price: 100, isDeleted: true },
      });
    },
    read: (id) => prisma.appointment.findUnique({ where: { id } }),
  },
  {
    path: 'reminders',
    seed: async (userId) => {
      const patient = await createTestPatient(userId);
      return prisma.reminder.create({
        data: { userId, patientId: patient.id, channel: 'SMS', to: '+573001112233', sendMode: 'SCHEDULED', sendAt: futureDate(), isDeleted: true },
      });
    },
    read: (id) => prisma.reminder.findUnique({ where: { id } }),
  },
  {
    path: 'locations',
    seed: (userId) => prisma.appointmentLocation.create({ data: { userId, name: 'Office', isDeleted: true } }),
    read: (id) => prisma.appointmentLocation.findUnique({ where: { id } }),
  },
  {
    path: 'appointment-types',
    seed: (userId) => prisma.appointmentType.create({ data: { userId, name: 'Consult', defaultDuration: 60, isDeleted: true } }),
    read: (id) => prisma.appointmentType.findUnique({ where: { id } }),
  },
  {
    path: 'blocked-time',
    seed: (userId) => {
      const { start, end } = appointmentTimeRange();
      return prisma.blockedTime.create({ data: { userId, startTimeUtc: start, endTimeUtc: end, isDeleted: true } });
    },
    read: (id) => prisma.blockedTime.findUnique({ where: { id } }),
  },
  {
    path: 'medical-records',
    seed: async (userId) => {
      const patient = await createTestPatient(userId);
      return prisma.medicalRecord.create({ data: { patientId: patient.id, isDeleted: true } });
    },
    read: (id) => prisma.medicalRecord.findUnique({ where: { id } }),
  },
  {
    path: 'users',
    seed: async () => {
      const user = await createTestUser();
      return prisma.user.update({ where: { id: user.id }, data: { isDeleted: true } });
    },
    read: (id) => prisma.user.findUnique({ where: { id } }),
  },
] satisfies RestoreTarget[];

let ipSequence = 0;

describe.each(targets)('restore authorization: $path', (target) => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let id: string;
  let ip: string;

  beforeEach(async () => {
    owner = await createTestUser({ role: AdminRole.SUPER_ADMIN });
    id = (await target.seed(owner.id)).id;
    // Isolate this test's requests from the real app's process-wide IP limiter.
    ip = `192.0.2.${++ipSequence}`;
  });

  function restore(token?: string, entityId = id) {
    const req = request(app).post(`/v1/${target.path}/${entityId}/restore`).set('X-Forwarded-For', ip);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }

  it('rejects unauthenticated, ADMIN and VIEWER requests without changing data or audits', async () => {
    const before = await target.read(id);
    const auditsBefore = await prisma.auditLog.findMany({ where: { entityId: id } });
    expect(before?.isDeleted).toBe(true);

    const anonymous = await restore();
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toMatchObject({ success: false, error: 'Unauthorized' });

    // Keep ownership identical so denial tests only the role in the signed token.
    for (const role of [AdminRole.ADMIN, AdminRole.VIEWER]) {
      const denied = await restore(createTestToken({ ...owner, role }));
      expect(denied.status).toBe(403);
      expect(denied.body).toMatchObject({ success: false, error: 'Insufficient permissions' });
    }
    expect(await target.read(id)).toEqual(before);
    expect(await prisma.auditLog.findMany({ where: { entityId: id } })).toEqual(auditsBefore);
  });

  it('allows SUPER_ADMIN and records the restore audit', async () => {
    const res = await restore(createTestToken(owner));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { id } });
    expect((await target.read(id))?.isDeleted).toBe(false);
    const audits = await prisma.auditLog.findMany({ where: { entityId: id, actionType: 'RESTORE' } });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.actorId).toBe(owner.id);
  });

  if (target.path !== 'users') {
    it('preserves tenant ownership checks for SUPER_ADMIN', async () => {
      const other = await createTestUser({ role: AdminRole.SUPER_ADMIN });
      const res = await restore(createTestToken(other));
      expect(res.status).toBe(404);
      expect((await target.read(id))?.isDeleted).toBe(true);
      expect(await prisma.auditLog.count({ where: { entityId: id, actionType: 'RESTORE' } })).toBe(0);
    });
  }

  if (target.path === 'appointments' || target.path === 'patients') {
    it('still rejects conflicting restores with 409 for SUPER_ADMIN', async () => {
      if (target.path === 'appointments') {
        const existing = await prisma.appointment.findUniqueOrThrow({ where: { id } });
        await prisma.appointment.create({
          data: { userId: owner.id, patientId: existing.patientId, locationId: existing.locationId, typeId: existing.typeId, startAt: existing.startAt, endAt: existing.endAt, price: 100 },
        });
      } else {
        const email = 'restore-conflict@test.local';
        await prisma.patient.update({ where: { id }, data: { email } });
        await createTestPatient(owner.id, { email });
      }
      const res = await restore(createTestToken(owner));
      expect(res.status).toBe(409);
      expect((await target.read(id))?.isDeleted).toBe(true);
      expect(await prisma.auditLog.count({ where: { entityId: id, actionType: 'RESTORE' } })).toBe(0);
    });
  }
});
