import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { patientService } from '../../../src/patients/patient.service.js';
import { auditLogRepository } from '../../../src/audit-log/audit-log.repository.js';
import { logAudit } from '../../../src/audit-log/audit-log.utils.js';
import { runInAuditContext } from '../../../src/audit-log/audit-log-context.js';
import { portalPatientAuditContext } from '../../../src/audit-log/audit-actors.js';
import { ActionSource, ActionType, EntityType } from '../../../generated/prisma/enums.ts';
import { createTestUser, unique } from '../helpers.js';

let userId: string;

beforeEach(async () => {
  userId = (await createTestUser()).id;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const newPatient = () => ({ name: 'Ana', lastName: 'Lopez', email: unique('audit@test.local'), status: 'ACTIVE' as const });

describe('required audit writes', () => {
  it('rolls back the patient when the required audit write fails', async () => {
    vi.spyOn(auditLogRepository, 'create').mockRejectedValueOnce(new Error('audit store down'));
    await expect(patientService.create(newPatient(), userId)).rejects.toThrow('audit store down');
    expect(await prisma.patient.count({ where: { userId } })).toBe(0);
  });

  it('rolls back an update and a delete when their audit fails', async () => {
    const patient = await patientService.create(newPatient(), userId);

    vi.spyOn(auditLogRepository, 'create').mockRejectedValueOnce(new Error('audit store down'));
    await expect(patientService.update(patient.id, { name: 'Changed' }, userId)).rejects.toThrow();
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } })).name).toBe('Ana');

    vi.spyOn(auditLogRepository, 'create').mockRejectedValueOnce(new Error('audit store down'));
    await expect(patientService.delete(patient.id, userId)).rejects.toThrow();
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } })).isDeleted).toBe(false);
  });

  it('keeps best-effort audits (default) non-fatal', async () => {
    vi.spyOn(auditLogRepository, 'create').mockRejectedValueOnce(new Error('audit store down'));
    await expect(
      logAudit({
        entityType: EntityType.USER,
        entityId: userId,
        userId,
        actionType: ActionType.UPDATE,
        description: 'best effort',
      }),
    ).resolves.toBeUndefined();
  });

  it('writes patient create/update/delete/restore audits in the same transaction as the change', async () => {
    const patient = await patientService.create(newPatient(), userId);
    await patientService.update(patient.id, { name: 'Changed' }, userId);
    await patientService.delete(patient.id, userId);
    await patientService.restore(patient.id, userId);
    const rows = await prisma.auditLog.findMany({ where: { entityType: EntityType.PATIENT, entityId: patient.id } });
    expect(rows.map((r) => r.actionType).sort()).toEqual(
      [ ActionType.CREATE, ActionType.DELETE, ActionType.RESTORE, ActionType.UPDATE ].sort(),
    );
  });
});

describe('portal audit actor and enum values', () => {
  it('records PUBLIC_PORTAL source, a hashed actor id and a masked display name', async () => {
    const ctx = portalPatientAuditContext({ userId, email: 'maria.perez@example.com', ipAddress: '10.0.0.1' });
    expect(ctx.actorId).toMatch(/^portal:[0-9a-f]{24}$/);
    expect(ctx.actorDisplayName).not.toContain('maria.perez');

    await runInAuditContext(ctx, () =>
      logAudit({
        entityType: EntityType.PATIENT_CONSENT,
        entityId: userId,
        userId,
        actionType: ActionType.CREATE,
        description: 'Consentimiento aceptado',
        required: true,
      }),
    );
    await runInAuditContext(ctx, () =>
      logAudit({
        entityType: EntityType.BOOKING_REQUEST,
        entityId: userId,
        userId,
        actionType: ActionType.CREATE,
        description: 'Solicitud creada',
        required: true,
      }),
    );

    const rows = await prisma.auditLog.findMany({ where: { userId, source: ActionSource.PUBLIC_PORTAL } });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.actorId).toBe(ctx.actorId);
    expect(rows[0]!.ipAddress).toBe('10.0.0.1');
  });

  it('keeps the same actor id for the same provider+email and differs across providers', () => {
    const a = portalPatientAuditContext({ userId: 'u1', email: 'x@y.co' });
    const b = portalPatientAuditContext({ userId: 'u1', email: 'x@y.co' });
    const c = portalPatientAuditContext({ userId: 'u2', email: 'x@y.co' });
    expect(a.actorId).toBe(b.actorId);
    expect(a.actorId).not.toBe(c.actorId);
  });
});
