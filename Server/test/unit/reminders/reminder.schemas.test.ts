import { describe, it, expect } from 'vitest';
import { createReminderSchema } from '../../../src/reminders/reminder.schemas.js';
import { bulkSendSchema, sendEmailSchema } from '../../../src/utils/validation/middleware.js';

const base = {
  sendMode: 'SCHEDULED',
  sendAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  patientId: '11111111-1111-4111-8111-111111111111',
};

describe('createReminderSchema recipient validation', () => {
  it('accepts an email recipient for EMAIL', () => {
    const r = createReminderSchema.safeParse({ ...base, channel: 'EMAIL', to: 'ana@example.com', body: 'Hola', subject: 'Cita' });
    expect(r.success).toBe(true);
  });

  it('rejects a phone recipient for EMAIL', () => {
    const r = createReminderSchema.safeParse({ ...base, channel: 'EMAIL', to: '+573001234567', body: 'Hola' });
    expect(r.success).toBe(false);
    expect(r.error!.issues[ 0 ]!.path).toEqual([ 'to' ]);
  });

  it('still requires E.164 for SMS and WHATSAPP', () => {
    expect(createReminderSchema.safeParse({ ...base, channel: 'SMS', to: 'ana@example.com', body: 'Hola' }).success).toBe(false);
    expect(createReminderSchema.safeParse({ ...base, channel: 'WHATSAPP', to: 'ana@example.com' }).success).toBe(false);
    expect(createReminderSchema.safeParse({ ...base, channel: 'SMS', to: '+573001234567', body: 'Hola' }).success).toBe(true);
  });
});

describe('sendEmailSchema', () => {
  it('requires a valid email and a body', () => {
    expect(sendEmailSchema.safeParse({ to: 'ana@example.com', body: 'Hola' }).success).toBe(true);
    expect(sendEmailSchema.safeParse({ to: 'not-an-email', body: 'Hola' }).success).toBe(false);
    expect(sendEmailSchema.safeParse({ to: 'ana@example.com', body: '' }).success).toBe(false);
  });
});

describe('bulkSendSchema', () => {
  const bulk = { templateKey: 'T', patientIds: [ base.patientId ], sendMode: 'IMMEDIATE' };

  it('requires body (each patient may be on SMS/EMAIL)', () => {
    expect(bulkSendSchema.safeParse(bulk).success).toBe(false);
    expect(bulkSendSchema.safeParse({ ...bulk, body: 'Hola {{1}}', subject: 'Cita' }).success).toBe(true);
  });
});
