import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the underlying Twilio SDK so no real network calls are made.
const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn().mockResolvedValue({ sid: 'SMtest', status: 'queued' }),
}));
vi.mock('twilio', () => {
  const client = { messages: { create: createMock } };
  return {
    default: vi.fn(() => client),
    __esModule: true,
  };
});

import { sendWhatsApp, sendSms, sendWhatsAppFreeForm } from '../../../src/twilio/client.js';
import { validateE164 } from '../../../src/twilio/validator.js';

beforeEach(() => {
  createMock.mockClear();
});

describe('twilio-client (integration, mocked SDK)', () => {
  it('sends a WhatsApp message with the whatsapp: prefix', async () => {
    const result = await sendWhatsApp({
      to: '+57300123456',
      contentSid: 'HXdummy',
      contentVariables: { '1': 'Maria' },
    });

    expect(result.success).toBe(true);
    expect(result.messageSid).toBe('SMtest');
    expect(result.channel).toBe('WHATSAPP');
    expect(createMock).toHaveBeenCalledTimes(1);
    const [params] = createMock.mock.calls[0]!;
    expect(params.to).toBe('whatsapp:+57300123456');
    expect(params.contentSid).toBe('HXdummy');
  });

  it('sends an SMS message', async () => {
    const result = await sendSms({ to: '+57300123456', body: 'Hello' });
    expect(result.channel).toBe('SMS');
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0]![0].body).toBe('Hello');
  });

  it('sends a free-form WhatsApp reply', async () => {
    const result = await sendWhatsAppFreeForm('+57300123456', 'Confirmed');
    expect(result.channel).toBe('WHATSAPP');
    expect(createMock.mock.calls[0]![0].body).toBe('Confirmed');
  });

  it('validates E164 numbers', () => {
    expect(() => validateE164('not-a-phone')).toThrow();
    expect(() => validateE164('+57300123456')).not.toThrow();
  });
});
