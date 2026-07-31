import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { auditLogService } from '../../../src/audit-log/audit-log.service.js';
import { auditLogRepository } from '../../../src/audit-log/audit-log.repository.js';
import { auditLogRouter } from '../../../src/audit-log/audit-log.routes.js';
import { AuditLogNotFoundError } from '../../../src/audit-log/audit-log.errors.js';
import { createTestUser, invokeRoute } from '../helpers.js';

let userId: string;

beforeEach(async () => {
  const user = await createTestUser();
  userId = user.id;
});

const baseLogData = {
  actorId: 'actor-123',
  actorDisplayName: 'Test Actor',
  entityType: 'PATIENT' as const,
  entityId: 'entity-456',
  actionType: 'CREATE' as const,
  source: 'API' as const,
  description: 'Created patient record',
  affectedFields: ['name', 'email'],
};

function baseReq(extra: Record<string, unknown> = {}) {
  return {
    user: { id: userId, timezone: 'America/Bogota' },
    ip: '127.0.0.1',
    ...extra,
  };
}

describe('auditLogRepository (integration)', () => {
  it('creates and reads back an audit log', async () => {
    const created = await auditLogRepository.create({ ...baseLogData, userId });
    expect(created.id).toBeTruthy();
    expect(created.entityType).toBe('PATIENT');
    expect(created.actionType).toBe('CREATE');
    expect(created.actorId).toBe('actor-123');

    const found = await auditLogRepository.findById(created.id, userId);
    expect(found.id).toBe(created.id);
  });

  it('throws AuditLogNotFoundError for non-existent id', async () => {
    await expect(
      auditLogRepository.findById('00000000-0000-0000-0000-000000000000', userId)
    ).rejects.toThrow(AuditLogNotFoundError);
  });

  it('lists audit logs with filters', async () => {
    await auditLogRepository.create({ ...baseLogData, userId });
    await auditLogRepository.create({
      ...baseLogData,
      userId,
      entityType: 'APPOINTMENT',
      actionType: 'UPDATE',
    });

    const all = await auditLogRepository.findMany(userId, { page: 1, pageSize: 20, orderBy: 'eventTimeUtc', order: 'desc' });
    expect(all.data).toHaveLength(2);
    expect(all.total).toBe(2);

    const filtered = await auditLogRepository.findMany(userId, {
      page: 1,
      pageSize: 20,
      orderBy: 'eventTimeUtc',
      order: 'desc',
      entityType: 'PATIENT',
    });
    expect(filtered.data).toHaveLength(1);
    expect(filtered.data[0]!.entityType).toBe('PATIENT');
  });

  it('paginates results', async () => {
    for (let i = 0; i < 3; i++) {
      await auditLogRepository.create({
        ...baseLogData,
        userId,
        entityId: `entity-${i}`,
      });
    }

    const page1 = await auditLogRepository.findMany(userId, { page: 1, pageSize: 2, orderBy: 'eventTimeUtc', order: 'desc' });
    expect(page1.data).toHaveLength(2);
    expect(page1.total).toBe(3);

    const page2 = await auditLogRepository.findMany(userId, { page: 2, pageSize: 2, orderBy: 'eventTimeUtc', order: 'desc' });
    expect(page2.data).toHaveLength(1);
  });
});

describe('auditLogService (integration)', () => {
  it('creates an audit log via service', async () => {
    const log = await auditLogService.create({ ...baseLogData, userId });
    expect(log).toBeTruthy();
    expect(log!.id).toBeTruthy();
    expect(log!.description).toBe('Created patient record');
  });

  it('finds audit log by id via service', async () => {
    const created = await auditLogService.create({ ...baseLogData, userId });
    expect(created).toBeTruthy();
    const found = await auditLogService.findById(created!.id, userId);
    expect(found.id).toBe(created!.id);
  });

  it('service exposes only create/findMany/findById (no update/delete)', () => {
    expect(typeof auditLogService.create).toBe('function');
    expect(typeof auditLogService.findMany).toBe('function');
    expect(typeof auditLogService.findById).toBe('function');
    expect((auditLogService as Record<string, unknown>).update).toBeUndefined();
    expect((auditLogService as Record<string, unknown>).delete).toBeUndefined();
    expect((auditLogService as Record<string, unknown>).upsert).toBeUndefined();
  });
});

describe('AuditLog Prisma guard (integration)', () => {
  it('rejects update on AuditLog', async () => {
    const created = await auditLogRepository.create({ ...baseLogData, userId });
    await expect(
      prisma.auditLog.update({
        where: { id: created.id },
        data: { description: 'hacked' },
      })
    ).rejects.toThrow('AuditLog is immutable');
  });

  it('rejects updateMany on AuditLog', async () => {
    await auditLogRepository.create({ ...baseLogData, userId });
    await expect(
      prisma.auditLog.updateMany({
        data: { description: 'hacked' },
      })
    ).rejects.toThrow('AuditLog is immutable');
  });

  it('rejects upsert on AuditLog', async () => {
    await expect(
      prisma.auditLog.upsert({
        where: { id: '00000000-0000-0000-0000-000000000000' },
        create: { ...baseLogData, userId, id: '00000000-0000-0000-0000-000000000000' },
        update: { description: 'hacked' },
      })
    ).rejects.toThrow('AuditLog is immutable');
  });

  it('rejects delete on AuditLog', async () => {
    const created = await auditLogRepository.create({ ...baseLogData, userId });
    await expect(
      prisma.auditLog.delete({ where: { id: created.id } })
    ).rejects.toThrow('AuditLog is immutable');
  });

  it('rejects deleteMany on AuditLog', async () => {
    await expect(
      prisma.auditLog.deleteMany()
    ).rejects.toThrow('AuditLog is immutable');
  });

  it('allows create on AuditLog', async () => {
    const log = await auditLogRepository.create({ ...baseLogData, userId });
    expect(log.id).toBeTruthy();
  });

  it('allows findMany on AuditLog', async () => {
    await auditLogRepository.create({ ...baseLogData, userId });
    const result = await auditLogRepository.findMany(userId, { page: 1, pageSize: 10, orderBy: 'eventTimeUtc', order: 'desc' });
    expect(result.data).toHaveLength(1);
  });
});

describe('audit-log routes (integration)', () => {
  it('GET / returns paginated audit logs', async () => {
    await auditLogService.create({ ...baseLogData, userId });

    const res = await invokeRoute(auditLogRouter, 'get', '/', baseReq({ query: {} }));
    expect(res.statusCode).toBe(200);
    const body = res.body as { data: { data: unknown[]; total: number } };
    expect(body.data.data).toHaveLength(1);
    expect(body.data.total).toBe(1);
  });

  it('GET / returns empty list when no logs exist', async () => {
    const res = await invokeRoute(auditLogRouter, 'get', '/', baseReq({ query: {} }));
    expect(res.statusCode).toBe(200);
    const body = res.body as { data: { data: unknown[]; total: number } };
    expect(body.data.data).toHaveLength(0);
    expect(body.data.total).toBe(0);
  });

  it('GET /:id returns a single audit log', async () => {
    const created = await auditLogService.create({ ...baseLogData, userId });
    expect(created).toBeTruthy();
    const res = await invokeRoute(
      auditLogRouter,
      'get',
      `/${created!.id}`,
      baseReq({ params: { id: created!.id } })
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as { data: { id: string } };
    expect(body.data.id).toBe(created!.id);
  });

  it('GET /:id returns 404 for non-existent id', async () => {
    const res = await invokeRoute(
      auditLogRouter,
      'get',
      '/00000000-0000-0000-0000-000000000000',
      baseReq({ params: { id: '00000000-0000-0000-0000-000000000000' } })
    );
    expect(res.statusCode).toBe(404);
  });

  it('GET /:id returns 400 for invalid UUID', async () => {
    const res = await invokeRoute(
      auditLogRouter,
      'get',
      '/not-a-uuid',
      baseReq({ params: { id: 'not-a-uuid' } })
    );
    expect(res.statusCode).toBe(400);
  });

  it('GET / supports filtering by entityType', async () => {
    await auditLogService.create({ ...baseLogData, userId, entityType: 'PATIENT' });
    await auditLogService.create({ ...baseLogData, userId, entityType: 'APPOINTMENT' });

    const res = await invokeRoute(
      auditLogRouter,
      'get',
      '/',
      baseReq({ query: { entityType: 'PATIENT' } })
    );
    expect(res.statusCode).toBe(200);
    const body = res.body as { data: { data: unknown[]; total: number } };
    expect(body.data.data).toHaveLength(1);
    expect(body.data.total).toBe(1);
  });
});
