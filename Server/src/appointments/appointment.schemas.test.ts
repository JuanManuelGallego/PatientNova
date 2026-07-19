// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { createAppointmentSchema, updateAppointmentSchema } from './appointment.schemas.js';

const validFuture = new Date(Date.now() + 86400000).toISOString();

const baseCreate = {
  startAt: validFuture,
  endAt: new Date(Date.now() + 2 * 86400000).toISOString(),
  price: 100,
  patientId: '550e8400-e29b-41d4-a716-446655440000',
  locationId: '550e8400-e29b-41d4-a716-446655440001',
  typeId: '550e8400-e29b-41d4-a716-446655440002',
};

const validReminder = {
  channel: 'WHATSAPP' as const,
  to: '+15551234567',
  sendMode: 'SCHEDULED' as const,
  sendAt: validFuture,
  contentSid: 'HX1234567890abcdef',
  contentVariables: { '1': 'John' },
  body: 'Hello {{1}}',
};

describe('createAppointmentSchema', () => {
  it('accepts valid minimal input', () => {
    const result = createAppointmentSchema.safeParse(baseCreate);
    expect(result.success).toBe(true);
  });

  it('defaults paid to false and status to SCHEDULED', () => {
    const result = createAppointmentSchema.parse(baseCreate);
    expect(result.paid).toBe(false);
    expect(result.status).toBe('SCHEDULED');
  });

  it('rejects missing required fields', () => {
    const result = createAppointmentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects negative price', () => {
    const result = createAppointmentSchema.safeParse({ ...baseCreate, price: -10 });
    expect(result.success).toBe(false);
  });

  it('accepts zero price', () => {
    const result = createAppointmentSchema.safeParse({ ...baseCreate, price: 0 });
    expect(result.success).toBe(true);
  });

  it('accepts valid reminder inline object', () => {
    const result = createAppointmentSchema.safeParse({
      ...baseCreate,
      reminder: validReminder,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reminder).toEqual(expect.objectContaining({
        channel: 'WHATSAPP',
        to: '+15551234567',
        sendMode: 'SCHEDULED',
      }));
    }
  });

  it('accepts reminder with null', () => {
    const result = createAppointmentSchema.safeParse({
      ...baseCreate,
      reminder: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts reminder with undefined (omitted)', () => {
    const result = createAppointmentSchema.safeParse({
      ...baseCreate,
      reminder: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('rejects both reminderId and reminder provided', () => {
    const result = createAppointmentSchema.safeParse({
      ...baseCreate,
      reminderId: '550e8400-e29b-41d4-a716-446655440099',
      reminder: validReminder,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const reminderError = result.error.issues.find(i => i.path.includes('reminder'));
      expect(reminderError).toBeDefined();
    }
  });

  it('accepts reminderId without reminder', () => {
    const result = createAppointmentSchema.safeParse({
      ...baseCreate,
      reminderId: '550e8400-e29b-41d4-a716-446655440099',
    });
    expect(result.success).toBe(true);
  });

  it('defaults reminder status to PENDING', () => {
    const { status: _, ...reminderWithoutStatus } = validReminder;
    const result = createAppointmentSchema.parse({
      ...baseCreate,
      reminder: reminderWithoutStatus,
    });
    expect(result.reminder?.status).toBe('PENDING');
  });

  it('rejects reminder missing channel', () => {
    const { channel, ...reminderWithoutChannel } = validReminder;
    const result = createAppointmentSchema.safeParse({
      ...baseCreate,
      reminder: reminderWithoutChannel,
    });
    expect(result.success).toBe(false);
  });

  it('rejects reminder missing to', () => {
    const { to, ...reminderWithoutTo } = validReminder;
    const result = createAppointmentSchema.safeParse({
      ...baseCreate,
      reminder: reminderWithoutTo,
    });
    expect(result.success).toBe(false);
  });

  it('rejects reminder missing sendAt for SCHEDULED mode', () => {
    const { sendAt, ...reminderWithoutSendAt } = validReminder;
    const result = createAppointmentSchema.safeParse({
      ...baseCreate,
      reminder: reminderWithoutSendAt,
    });
    expect(result.success).toBe(false);
  });

  it('accepts IMMEDIATE mode without sendAt', () => {
    const result = createAppointmentSchema.safeParse({
      ...baseCreate,
      reminder: {
        channel: 'WHATSAPP',
        to: '+15551234567',
        sendMode: 'IMMEDIATE',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid channel', () => {
    const result = createAppointmentSchema.safeParse({
      ...baseCreate,
      reminder: { ...validReminder, channel: 'CARRIER_PIGEON' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid sendMode', () => {
    const result = createAppointmentSchema.safeParse({
      ...baseCreate,
      reminder: { ...validReminder, sendMode: 'WEEKLY' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional reminder fields (contentSid, contentVariables, body)', () => {
    const result = createAppointmentSchema.safeParse({
      ...baseCreate,
      reminder: {
        channel: 'WHATSAPP',
        to: '+15551234567',
        sendMode: 'IMMEDIATE',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reminder?.contentSid).toBeUndefined();
      expect(result.data.reminder?.contentVariables).toBeUndefined();
      expect(result.data.reminder?.body).toBeUndefined();
      expect(result.data.reminder?.sendAt).toBeUndefined();
    }
  });

  it('accepts body with max 500 chars', () => {
    const result = createAppointmentSchema.safeParse({
      ...baseCreate,
      reminder: { ...validReminder, body: 'a'.repeat(500) },
    });
    expect(result.success).toBe(true);
  });

  it('rejects body exceeding 1000 chars', () => {
    const result = createAppointmentSchema.safeParse({
      ...baseCreate,
      reminder: { ...validReminder, body: 'a'.repeat(1001) },
    });
    expect(result.success).toBe(false);
  });

  it('rejects startAt in the past', () => {
    const result = createAppointmentSchema.safeParse({
      ...baseCreate,
      startAt: new Date(Date.now() - 86400000).toISOString(),
      endAt: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('startAt'));
      expect(error).toBeDefined();
    }
  });
});

describe('updateAppointmentSchema', () => {
  it('accepts valid minimal update', () => {
    const result = updateAppointmentSchema.safeParse({ price: 200 });
    expect(result.success).toBe(true);
  });

  it('accepts update with only undefined optional fields', () => {
    const result = updateAppointmentSchema.safeParse({
      price: undefined,
      notes: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('accepts update with reminder null (cancel)', () => {
    const result = updateAppointmentSchema.safeParse({ reminder: null });
    expect(result.success).toBe(true);
  });

  it('accepts reminder inline object', () => {
    const result = updateAppointmentSchema.safeParse({
      price: 200,
      reminder: validReminder,
    });
    expect(result.success).toBe(true);
  });

  it('accepts reminder as null (cancel)', () => {
    const result = updateAppointmentSchema.safeParse({
      price: 200,
      reminder: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects both reminderId and reminder', () => {
    const result = updateAppointmentSchema.safeParse({
      price: 200,
      reminderId: '550e8400-e29b-41d4-a716-446655440099',
      reminder: validReminder,
    });
    expect(result.success).toBe(false);
  });

  it('accepts reminderId without reminder', () => {
    const result = updateAppointmentSchema.safeParse({
      price: 200,
      reminderId: '550e8400-e29b-41d4-a716-446655440099',
    });
    expect(result.success).toBe(true);
  });

  it('accepts reminderId as null (disconnect)', () => {
    const result = updateAppointmentSchema.safeParse({
      price: 200,
      reminderId: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial reminder update fields', () => {
    const result = updateAppointmentSchema.safeParse({
      reminder: {
        channel: 'SMS',
        to: '+15559876543',
        sendMode: 'IMMEDIATE',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects startAt in the past on update', () => {
    const result = updateAppointmentSchema.safeParse({
      startAt: new Date(Date.now() - 86400000).toISOString(),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(i => i.path.includes('startAt'));
      expect(error).toBeDefined();
    }
  });

  it('accepts update without startAt (no past check)', () => {
    const result = updateAppointmentSchema.safeParse({ price: 200 });
    expect(result.success).toBe(true);
  });
});
