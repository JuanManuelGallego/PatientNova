import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { patientService } from '../../../src/patients/patient.service.js';
import { locationService } from '../../../src/locations/location.service.js';
import { appointmentTypeService } from '../../../src/appointment-types/appointment-type.service.js';
import { blockedTimeService } from '../../../src/blocked-time/blocked-time.service.js';
import { medicalRecordService } from '../../../src/medical-records/medical-record.service.js';
import { createTestUser, unique } from '../helpers.js';
import { runInAuditContext } from '../../../src/audit-log/audit-log-context.js';

let userId: string;
let userEmail: string;

beforeEach(async () => {
  const user = await createTestUser();
  userId = user.id;
  userEmail = user.email;
});

function withAuditContext<T>(fn: () => T): T {
  return runInAuditContext({
    actorId: userId,
    actorDisplayName: userEmail,
    ipAddress: '127.0.0.1',
    userId,
  }, fn);
}

async function getLatestAuditLog(entityType: string, entityId: string) {
  return prisma.auditLog.findFirst({
    where: { entityType: entityType as any, entityId },
    orderBy: { eventTimeUtc: 'desc' },
  });
}

async function getAuditLogsForEntity(entityType: string, entityId: string) {
  return prisma.auditLog.findMany({
    where: { entityType: entityType as any, entityId },
    orderBy: { eventTimeUtc: 'desc' },
  });
}

describe('Audit writing: patients (integration)', () => {
  it('creates an audit log on patient create', async () => {
    const patient = await withAuditContext(() => patientService.create({
      name: 'Maria',
      lastName: 'Garcia',
      email: unique('patient@test.local'),
      status: 'ACTIVE',
    }, userId));

    const log = await getLatestAuditLog('PATIENT', patient.id);
    expect(log).toBeTruthy();
    expect(log!.actionType).toBe('CREATE');
    expect(log!.actorId).toBe(userId);
    expect(log!.source).toBe('API');
    expect(log!.entityId).toBe(patient.id);
  });

  it('creates an audit log on patient update with diff', async () => {
    const patient = await withAuditContext(() => patientService.create({
      name: 'Maria',
      lastName: 'Garcia',
      email: unique('patient@test.local'),
      status: 'ACTIVE',
    }, userId));

    await withAuditContext(() => patientService.update(patient.id, { name: 'Ana' }, userId));

    const logs = await getAuditLogsForEntity('PATIENT', patient.id);
    const updateLog = logs.find(l => l.actionType === 'UPDATE');
    expect(updateLog).toBeTruthy();
    expect(updateLog!.affectedFields).toContain('name');
    expect(updateLog!.fieldsBefore).toMatchObject({ name: 'Maria' });
    expect(updateLog!.fieldsAfter).toMatchObject({ name: 'Ana' });
  });

  it('creates an audit log on patient delete', async () => {
    const patient = await withAuditContext(() => patientService.create({
      name: 'Maria',
      lastName: 'Garcia',
      email: unique('patient@test.local'),
      status: 'ACTIVE',
    }, userId));

    await withAuditContext(() => patientService.delete(patient.id, userId));

    const logs = await getAuditLogsForEntity('PATIENT', patient.id);
    const deleteLog = logs.find(l => l.actionType === 'DELETE');
    expect(deleteLog).toBeTruthy();
    expect(deleteLog!.fieldsBefore).toMatchObject({ isDeleted: false });
  });

  it('creates an audit log on patient restore', async () => {
    const patient = await withAuditContext(() => patientService.create({
      name: 'Maria',
      lastName: 'Garcia',
      email: unique('patient@test.local'),
      status: 'ACTIVE',
    }, userId));

    await withAuditContext(() => patientService.delete(patient.id, userId));
    await withAuditContext(() => patientService.restore(patient.id, userId));

    const logs = await getAuditLogsForEntity('PATIENT', patient.id);
    const restoreLog = logs.find(l => l.actionType === 'RESTORE');
    expect(restoreLog).toBeTruthy();
    expect(restoreLog!.fieldsAfter).toMatchObject({ isDeleted: false });
  });
});

describe('Audit writing: locations (integration)', () => {
  it('creates an audit log on location create', async () => {
    const location = await withAuditContext(() => locationService.create({
      name: 'Main Office',
      isVirtual: false,
    }, userId));

    const log = await getLatestAuditLog('APPOINTMENT_LOCATION', location.id);
    expect(log).toBeTruthy();
    expect(log!.actionType).toBe('CREATE');
    expect(log!.actorId).toBe(userId);
  });

  it('creates an audit log on location update with diff', async () => {
    const location = await withAuditContext(() => locationService.create({
      name: 'Main Office',
      isVirtual: false,
    }, userId));

    await withAuditContext(() => locationService.update(location.id, { name: 'New Office' }, userId));

    const logs = await getAuditLogsForEntity('APPOINTMENT_LOCATION', location.id);
    const updateLog = logs.find(l => l.actionType === 'UPDATE');
    expect(updateLog).toBeTruthy();
    expect(updateLog!.affectedFields).toContain('name');
  });
});

describe('Audit writing: appointment types (integration)', () => {
  it('creates an audit log on type create', async () => {
    const type = await withAuditContext(() => appointmentTypeService.create({
      name: 'Consult',
      defaultDuration: 60,
    }, userId));

    const log = await getLatestAuditLog('APPOINTMENT_TYPE', type.id);
    expect(log).toBeTruthy();
    expect(log!.actionType).toBe('CREATE');
  });
});

describe('Audit writing: blocked time (integration)', () => {
  it('creates an audit log on blocked time create', async () => {
    const start = new Date(Date.now() + 240 * 60_000);
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60_000);

    const bt = await withAuditContext(() => blockedTimeService.create({
      description: 'Lunch break',
      startTimeUtc: start.toISOString(),
      endTimeUtc: end.toISOString(),
    }, userId));

    const log = await getLatestAuditLog('BLOCKED_TIME', bt.id);
    expect(log).toBeTruthy();
    expect(log!.actionType).toBe('CREATE');
    expect(log!.actorId).toBe(userId);
  });
});

describe('Audit writing: medical records (integration)', () => {
  it('creates an audit log on medical record create', async () => {
    const patient = await prisma.patient.create({
      data: { name: 'Test', lastName: 'Patient', email: unique('patient@test.local'), status: 'ACTIVE', userId },
    });

    const record = await withAuditContext(() => medicalRecordService.create({
      patientId: patient.id,
    }, userId));

    const log = await getLatestAuditLog('MEDICAL_RECORD', record.id);
    expect(log).toBeTruthy();
    expect(log!.actionType).toBe('CREATE');
  });
});

describe('Audit writing: actor metadata (integration)', () => {
  it('captures actor ID and IP from audit context', async () => {
    const patient = await withAuditContext(() => patientService.create({
      name: 'Maria',
      lastName: 'Garcia',
      email: unique('patient@test.local'),
      status: 'ACTIVE',
    }, userId));

    const log = await getLatestAuditLog('PATIENT', patient.id);
    expect(log!.actorId).toBe(userId);
    expect(log!.ipAddress).toBe('127.0.0.1');
  });

  it('uses system defaults when no audit context', async () => {
    const patient = await patientService.create({
      name: 'Maria',
      lastName: 'Garcia',
      email: unique('patient@test.local'),
      status: 'ACTIVE',
    }, userId);

    const log = await getLatestAuditLog('PATIENT', patient.id);
    expect(log!.actorId).toBe('system');
    expect(log!.actorDisplayName).toBe('Sistema');
  });
});

describe('Audit writing: immutability after creation (integration)', () => {
  it('audit logs cannot be updated via Prisma', async () => {
    const patient = await withAuditContext(() => patientService.create({
      name: 'Maria',
      lastName: 'Garcia',
      email: unique('patient@test.local'),
      status: 'ACTIVE',
    }, userId));

    const log = await getLatestAuditLog('PATIENT', patient.id);
    expect(log).toBeTruthy();

    await expect(
      prisma.auditLog.update({
        where: { id: log!.id },
        data: { description: 'hacked' },
      })
    ).rejects.toThrow('AuditLog is immutable');
  });
});
