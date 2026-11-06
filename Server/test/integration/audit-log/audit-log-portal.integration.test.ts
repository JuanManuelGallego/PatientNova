import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { auditLogRouter } from '../../../src/audit-log/audit-log.routes.js';
import { auditLogService } from '../../../src/audit-log/audit-log.service.js';
import { portalActorId, portalPatientAuditContext } from '../../../src/audit-log/audit-actors.js';
import { emailContact } from '../../../src/portal/portal-contact.js';
import { runInAuditContext } from '../../../src/audit-log/audit-log-context.js';
import { logAudit } from '../../../src/audit-log/audit-log.utils.js';
import { resolvePortalPatient } from '../../../src/portal/patient-resolution.js';
import { ActionSource, ActionType, EntityType } from '../../../generated/prisma/enums.js';
import { createTestPatient, createTestUser, invokeRoute, unique } from '../helpers.js';

let userId: string;

beforeEach(async () => {
  userId = (await createTestUser()).id;
});

function listReq(query: Record<string, unknown>, ownerId = userId) {
  return { user: { id: ownerId, timezone: 'America/Bogota' }, ip: '127.0.0.1', query };
}

interface ListBody { data: { data: { id: string; actorId: string; source: string; entityId: string }[]; total: number } }

async function list(query: Record<string, unknown>, ownerId = userId) {
  const res = await invokeRoute(auditLogRouter, 'get', '/', listReq(query, ownerId));
  return { status: res.statusCode, body: res.body as ListBody };
}

async function portalAudit(ownerId: string, email: string, entityId = randomUUID(), opts: { resolve?: boolean } = {}) {
  await runInAuditContext(portalPatientAuditContext({ userId: ownerId, contact: emailContact(email), ipAddress: '203.0.113.7' }), async () => {
    if (opts.resolve) await resolvePortalPatient({ userId: ownerId, contact: emailContact(email) });
    await logAudit({
      entityType: EntityType.APPOINTMENT,
      entityId,
      userId: ownerId,
      actionType: ActionType.UPDATE,
      description: 'Cita cancelada por el paciente desde el portal',
      required: true,
    });
  });
  return entityId;
}

async function providerAudit(source: ActionSource) {
  await auditLogService.createOrThrow({
    userId,
    actorId: 'provider',
    actorDisplayName: 'Proveedor',
    entityType: EntityType.PATIENT,
    entityId: randomUUID(),
    actionType: ActionType.CREATE,
    source,
    description: 'Paciente creado',
    affectedFields: [],
  });
}

describe('audit-log source filter', () => {
  it('accepts several sources', async () => {
    await providerAudit(ActionSource.API);
    await providerAudit(ActionSource.JOB);
    await portalAudit(userId, unique('p@test.local'));

    const both = await list({ source: [ 'JOB', 'PUBLIC_PORTAL' ] });
    expect(both.status).toBe(200);
    expect(both.body.data.data.map((r) => r.source).sort()).toEqual([ 'JOB', 'PUBLIC_PORTAL' ]);

    const portal = await list({ source: 'PUBLIC_PORTAL' });
    expect(portal.body.data.total).toBe(1);
    expect(portal.body.data.data[0]!.actorId).toMatch(/^portal:[0-9a-f]{24}$/);
  });

  it('rejects an unknown source', async () => {
    expect((await list({ source: [ 'API', 'NOPE' ] })).status).toBe(400);
  });
});

describe('audit-log portalPatientId filter', () => {
  it('portalActorId is the actor the portal writes', async () => {
    const email = unique('p@test.local');
    await portalAudit(userId, email);
    const row = await prisma.auditLog.findFirstOrThrow({ where: { userId, source: ActionSource.PUBLIC_PORTAL } });
    expect(row.actorId).toBe(portalActorId(userId, email));
    expect(portalActorId(userId, `  ${email.toUpperCase()} `)).toBe(row.actorId);
  });

  it("returns only that patient's portal rows", async () => {
    const patient = await createTestPatient(userId);
    const other = await createTestPatient(userId);
    const own = await portalAudit(userId, patient.email!);
    await portalAudit(userId, other.email!);
    await providerAudit(ActionSource.API);

    const res = await list({ portalPatientId: patient.id });
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.data[0]!.entityId).toBe(own);
  });

  it('includes deleted patients', async () => {
    const patient = await createTestPatient(userId);
    await portalAudit(userId, patient.email!);
    await prisma.patient.update({ where: { id: patient.id }, data: { isDeleted: true, deletedAt: new Date() } });
    expect((await list({ portalPatientId: patient.id })).body.data.total).toBe(1);
  });

  it("never matches another provider's rows or patients", async () => {
    const otherProvider = (await createTestUser()).id;
    const email = unique('shared@test.local');
    const mine = await createTestPatient(userId, { email });
    const theirs = await createTestPatient(otherProvider, { email });
    await portalAudit(otherProvider, email);

    expect((await list({ portalPatientId: mine.id })).body.data.total).toBe(0);
    const foreign = await list({ portalPatientId: theirs.id });
    expect(foreign.status).toBe(200);
    expect(foreign.body.data.total).toBe(0);
  });

  it('matches unlinked rows by the current email only', async () => {
    const patient = await createTestPatient(userId);
    await portalAudit(userId, patient.email!);
    await prisma.patient.update({ where: { id: patient.id }, data: { email: unique('new@test.local') } });
    expect((await list({ portalPatientId: patient.id })).body.data.total).toBe(0);
  });

  it('links rows to the resolved patient record', async () => {
    const patient = await createTestPatient(userId);
    await portalAudit(userId, patient.email!, randomUUID(), { resolve: true });
    const row = await prisma.auditLog.findFirstOrThrow({ where: { userId, source: ActionSource.PUBLIC_PORTAL } });
    expect(row.portalPatientId).toBe(patient.id);
  });

  it('keeps linked rows after an email change', async () => {
    const patient = await createTestPatient(userId);
    const own = await portalAudit(userId, patient.email!, randomUUID(), { resolve: true });
    await prisma.patient.update({ where: { id: patient.id }, data: { email: unique('new@test.local') } });
    const res = await list({ portalPatientId: patient.id });
    expect(res.body.data.data.map((r) => r.entityId)).toEqual([ own ]);
  });

  it("never shows another record's linked rows, even with the same email", async () => {
    const email = unique('reused@test.local');
    const old = await createTestPatient(userId, { email });
    const oldAction = await portalAudit(userId, email, randomUUID(), { resolve: true });
    await prisma.patient.update({ where: { id: old.id }, data: { isDeleted: true, deletedAt: new Date() } });
    const replacement = await createTestPatient(userId, { email });
    const newAction = await portalAudit(userId, email, randomUUID(), { resolve: true });

    expect((await list({ portalPatientId: replacement.id })).body.data.data.map((r) => r.entityId)).toEqual([ newAction ]);
    expect((await list({ portalPatientId: old.id })).body.data.data.map((r) => r.entityId)).toEqual([ oldAction ]);
  });

  it('only returns portal rows, whatever else is linked', async () => {
    const patient = await createTestPatient(userId);
    await portalAudit(userId, patient.email!, randomUUID(), { resolve: true });
    await runInAuditContext({ actorId: 'provider', actorDisplayName: 'Proveedor', userId, source: ActionSource.API }, async () => {
      await resolvePortalPatient({ userId, contact: emailContact(patient.email!) });
      await logAudit({ entityType: EntityType.PATIENT, entityId: patient.id, userId, actionType: ActionType.UPDATE, description: 'x', required: true });
    });
    const providerRow = await prisma.auditLog.findFirstOrThrow({ where: { userId, source: ActionSource.API } });
    expect(providerRow.portalPatientId).toBeNull();
    expect((await list({ portalPatientId: patient.id })).body.data.total).toBe(1);
  });

  it('returns an empty page for an unknown patient', async () => {
    const res = await list({ portalPatientId: randomUUID() });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ data: [], total: 0 });
  });

  it('cannot be combined with actorId', async () => {
    const patient = await createTestPatient(userId);
    expect((await list({ portalPatientId: patient.id, actorId: 'x' })).status).toBe(400);
  });
});
