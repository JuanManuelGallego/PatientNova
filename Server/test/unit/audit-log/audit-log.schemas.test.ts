import { describe, it, expect } from 'vitest';
import { createAuditLogSchema, listAuditLogsSchema } from '../../../src/audit-log/audit-log.schemas.js';

describe('createAuditLogSchema', () => {
  const validDto = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    actorId: 'actor-1',
    actorDisplayName: 'Test Actor',
    entityType: 'PATIENT',
    entityId: '550e8400-e29b-41d4-a716-446655440001',
    actionType: 'CREATE',
    source: 'API',
    description: 'Created patient',
    affectedFields: ['name'],
  };

  it('accepts a valid dto', () => {
    const result = createAuditLogSchema.safeParse(validDto);
    expect(result.success).toBe(true);
  });

  it('accepts dto with optional fields', () => {
    const result = createAuditLogSchema.safeParse({
      ...validDto,
      userId: '550e8400-e29b-41d4-a716-446655440000',
      fieldsBefore: { name: 'old' },
      fieldsAfter: { name: 'new' },
      reason: 'Audit trail',
      ipAddress: '127.0.0.1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing actorId', () => {
    const { actorId, ...rest } = validDto;
    const result = createAuditLogSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects empty actorId', () => {
    const result = createAuditLogSchema.safeParse({ ...validDto, actorId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing entityType', () => {
    const { entityType, ...rest } = validDto;
    const result = createAuditLogSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid entityType', () => {
    const result = createAuditLogSchema.safeParse({ ...validDto, entityType: 'INVALID' });
    expect(result.success).toBe(false);
  });

  it('rejects missing actionType', () => {
    const { actionType, ...rest } = validDto;
    const result = createAuditLogSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid actionType', () => {
    const result = createAuditLogSchema.safeParse({ ...validDto, actionType: 'PATCH' });
    expect(result.success).toBe(false);
  });

  it('rejects missing source', () => {
    const { source, ...rest } = validDto;
    const result = createAuditLogSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid source', () => {
    const result = createAuditLogSchema.safeParse({ ...validDto, source: 'CLI' });
    expect(result.success).toBe(false);
  });

  it('defaults affectedFields to empty array', () => {
    const { affectedFields, ...rest } = validDto;
    const result = createAuditLogSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.affectedFields).toEqual([]);
    }
  });

  it('rejects actorDisplayName over 200 chars', () => {
    const result = createAuditLogSchema.safeParse({
      ...validDto,
      actorDisplayName: 'x'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('rejects description over 500 chars', () => {
    const result = createAuditLogSchema.safeParse({
      ...validDto,
      description: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid entity types', () => {
    for (const entityType of ['USER', 'APPOINTMENT', 'PATIENT', 'REMINDER', 'MEDICAL_RECORD', 'APPOINTMENT_TYPE', 'APPOINTMENT_LOCATION', 'BLOCKED_TIME', 'CONSENT_DOCUMENT']) {
      const result = createAuditLogSchema.safeParse({ ...validDto, entityType });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all valid action types', () => {
    for (const actionType of ['CREATE', 'UPDATE', 'DELETE', 'RESTORE']) {
      const result = createAuditLogSchema.safeParse({ ...validDto, actionType });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all valid sources', () => {
    for (const source of ['API', 'ADMIN_PANEL', 'JOB', 'MIGRATION']) {
      const result = createAuditLogSchema.safeParse({ ...validDto, source });
      expect(result.success).toBe(true);
    }
  });
});

describe('listAuditLogsSchema', () => {
  it('applies defaults for empty query', () => {
    const result = listAuditLogsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
      expect(result.data.orderBy).toBe('eventTimeUtc');
      expect(result.data.order).toBe('desc');
    }
  });

  it('parses string page/pageSize from query strings', () => {
    const result = listAuditLogsSchema.safeParse({ page: '3', pageSize: '10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(10);
    }
  });

  it('accepts valid filter values', () => {
    const result = listAuditLogsSchema.safeParse({
      entityType: 'PATIENT',
      entityId: '550e8400-e29b-41d4-a716-446655440000',
      actionType: 'UPDATE',
      source: 'API',
      actorId: 'a-1',
      search: 'test',
      orderBy: 'actionType',
      order: 'asc',
    });
    expect(result.success).toBe(true);
  });

  it('rejects page < 1', () => {
    const result = listAuditLogsSchema.safeParse({ page: '0' });
    expect(result.success).toBe(false);
  });

  it('rejects pageSize > 100', () => {
    const result = listAuditLogsSchema.safeParse({ pageSize: '101' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid orderBy', () => {
    const result = listAuditLogsSchema.safeParse({ orderBy: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid order', () => {
    const result = listAuditLogsSchema.safeParse({ order: 'random' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid entityType filter', () => {
    const result = listAuditLogsSchema.safeParse({ entityType: 'INVALID' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid actionType filter', () => {
    const result = listAuditLogsSchema.safeParse({ actionType: 'PATCH' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid source filter', () => {
    const result = listAuditLogsSchema.safeParse({ source: 'CLI' });
    expect(result.success).toBe(false);
  });
});
