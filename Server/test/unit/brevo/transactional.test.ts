import { describe, expect, it, vi } from 'vitest';

const sendEmailMock = vi.hoisted(() => vi.fn());
vi.mock('../../../src/brevo/email-client.js', () => ({ sendEmail: sendEmailMock }));
vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  maskEmail: (e: string) => `${e[0]}***`,
}));

import { sendTransactionalEmail } from '../../../src/brevo/transactional.js';
import {
  renderBookingConfirmationEmail,
  renderBookingRequestReceivedEmail,
  renderOtpEmail,
} from '../../../src/brevo/email-templates.js';
import { logger } from '../../../src/utils/api/logger.js';

describe('sendTransactionalEmail', () => {
  it('reports success without exposing anything else', async () => {
    sendEmailMock.mockResolvedValue({ success: true, messageSid: 'abc' });
    await expect(sendTransactionalEmail('a@b.co', { subject: 's', body: 'b' })).resolves.toEqual({ sent: true });
  });

  it('never throws and never leaks provider error text; logs only masked details', async () => {
    const err = Object.assign(new Error('Brevo: sender not verified for acme-secret'), { code: 401 });
    sendEmailMock.mockRejectedValue(err);
    const result = await sendTransactionalEmail('ana@example.com', { subject: 's', body: 'b' });
    expect(result).toEqual({ sent: false });
    const logged = JSON.stringify((logger.error as any).mock.calls);
    expect(logged).not.toContain('acme-secret');
    expect(logged).not.toContain('ana@example.com');
    expect(logged).toContain('401');
  });
});

describe('Spanish templates', () => {
  it('OTP email carries the code and expiry but no link', () => {
    const e = renderOtpEmail({ code: '123456', providerName: 'Dra. Pérez', ttlMinutes: 10 });
    expect(e.subject).toContain('123456');
    expect(e.body).toContain('Dra. Pérez');
    expect(e.body).toContain('10 minutos');
    expect(e.body).not.toMatch(/https?:\/\//);
  });

  it('confirmation links to the appointments page without tokens', () => {
    const url = 'https://patientnova.net/book/dra-perez/appointments';
    const e = renderBookingConfirmationEmail({
      providerName: 'Dra. Pérez',
      whenLocal: 'martes 20 de octubre de 2026, 10:30',
      locationName: 'Consultorio Centro',
      appointmentsUrl: url,
    });
    expect(e.body).toContain(url);
    expect(e.body).toContain('Consultorio Centro');
    expect(e.body).not.toMatch(/[?&](token|code|key)=/i);
    expect(renderBookingConfirmationEmail({ providerName: 'X', whenLocal: 'y', appointmentsUrl: url }).body).not.toContain('Lugar:');
    expect(renderBookingRequestReceivedEmail({ providerName: 'X', appointmentsUrl: url }).body).toContain(url);
  });
});
