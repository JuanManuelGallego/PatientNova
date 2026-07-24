import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/prisma/prisma-client.js', () => ({
  prisma: {
    reminder: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    appointment: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../../src/utils/config/config.js', () => ({
  config: {
    twilio: { appointmentStatusUpdateSid: 'status-update-sid' },
    defaults: { timezone: 'America/Bogota' },
  },
}));

vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../src/twilio/client.js', () => ({
  sendWhatsAppFreeForm: vi.fn(),
  sendWhatsApp: vi.fn(),
  sendSms: vi.fn(),
}));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { sendWhatsAppFreeForm, sendWhatsApp, sendSms } from '../../../src/twilio/client.js';

const mockPrisma = vi.mocked(prisma) as any;
const mockSendWhatsAppFreeForm = vi.mocked(sendWhatsAppFreeForm);
const mockSendWhatsApp = vi.mocked(sendWhatsApp);
const mockSendSms = vi.mocked(sendSms);

// Import after mocks
import { TwilioWebhookService } from '../../../src/twilio/webhook.service.js';

const service = new TwilioWebhookService();

beforeEach(() => vi.clearAllMocks());

describe('TwilioWebhookService.normalizePhoneNumber', () => {
  it('strips whatsapp: prefix', () => {
    expect(service.normalizePhoneNumber('whatsapp:+15551234567')).toBe('+15551234567');
  });

  it('strips WHATSAPP: prefix case-insensitively', () => {
    expect(service.normalizePhoneNumber('WHATSAPP:+15551234567')).toBe('+15551234567');
  });

  it('trims whitespace', () => {
    expect(service.normalizePhoneNumber('  +15551234567  ')).toBe('+15551234567');
  });

  it('returns number unchanged if no prefix', () => {
    expect(service.normalizePhoneNumber('+15551234567')).toBe('+15551234567');
  });
});

describe('TwilioWebhookService.validateWebhookPayload', () => {
  it('returns valid result with phone and button payload', () => {
    const result = service.validateWebhookPayload({
      from: 'whatsapp:+15551234567',
      buttonPayload: 'confirm',
    });
    expect(result).toEqual({ isValid: true, phoneNumber: '+15551234567', buttonPayload: 'confirm' });
  });

  it('returns invalid when from is missing', () => {
    const result = service.validateWebhookPayload({ buttonPayload: 'confirm' });
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Missing "From" field');
  });

  it('returns invalid when from is empty', () => {
    const result = service.validateWebhookPayload({ from: '', buttonPayload: 'confirm' });
    expect(result.isValid).toBe(false);
  });

  it('returns invalid when buttonPayload is missing', () => {
    const result = service.validateWebhookPayload({ from: 'whatsapp:+15551234567' });
    expect(result.isValid).toBe(false);
  });

  it('returns invalid when buttonPayload is empty', () => {
    const result = service.validateWebhookPayload({ from: 'whatsapp:+15551234567', buttonPayload: '' });
    expect(result.isValid).toBe(false);
  });
});

describe('TwilioWebhookService.determineUserIntent', () => {
  it('returns confirm intent', () => {
    expect(service.determineUserIntent('confirm')).toEqual({ intent: 'confirm' });
  });

  it('returns cancel intent', () => {
    expect(service.determineUserIntent('cancel')).toEqual({ intent: 'cancel' });
  });

  it('returns confirm for payload containing confirm', () => {
    expect(service.determineUserIntent('user_confirm_yes')).toEqual({ intent: 'confirm' });
  });

  it('returns cancel for payload containing cancel', () => {
    expect(service.determineUserIntent('user_cancel_no')).toEqual({ intent: 'cancel' });
  });

  it('returns null for unrecognised payload', () => {
    expect(service.determineUserIntent('maybe')).toEqual({ intent: null });
  });

  it('returns null for empty payload', () => {
    expect(service.determineUserIntent('')).toEqual({ intent: null });
  });
});

describe('TwilioWebhookService.findActiveReminder', () => {
  it('finds the most recent active reminder for a phone number', async () => {
    const fakeReminder = {
      id: 'rem-1',
      to: '+15551234567',
      channel: 'WHATSAPP',
      appointmentId: 'appt-1',
      appointment: { id: 'appt-1', status: 'SCHEDULED' },
    };
    mockPrisma.reminder.findFirst.mockResolvedValue(fakeReminder);

    const result = await service.findActiveReminder('+15551234567');

    expect(result).toEqual(fakeReminder);
    expect(mockPrisma.reminder.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        to: '+15551234567',
        channel: 'WHATSAPP',
      }),
      orderBy: { sendAt: 'desc' },
      include: { appointment: true },
    }));
  });

  it('returns null when no reminder found', async () => {
    mockPrisma.reminder.findFirst.mockResolvedValue(null);
    const result = await service.findActiveReminder('+15551234567');
    expect(result).toBeNull();
  });
});

describe('TwilioWebhookService.confirmAppointment', () => {
  it('confirms appointment and sends WhatsApp reply', async () => {
    mockPrisma.$transaction.mockResolvedValue([]);
    mockSendWhatsAppFreeForm.mockResolvedValue({} as never);

    const reminder = { id: 'rem-1', appointmentId: 'appt-1' } as Parameters<typeof service.confirmAppointment>[0];
    await service.confirmAppointment(reminder, '+15551234567');

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockSendWhatsAppFreeForm).toHaveBeenCalledWith('+15551234567', expect.stringContaining('confirmada'));
  });

  it('succeeds even if WhatsApp reply fails', async () => {
    mockPrisma.$transaction.mockResolvedValue([]);
    mockSendWhatsAppFreeForm.mockRejectedValue(new Error('Twilio error'));

    const reminder = { id: 'rem-1', appointmentId: 'appt-1' } as Parameters<typeof service.confirmAppointment>[0];
    await expect(service.confirmAppointment(reminder, '+15551234567')).resolves.not.toThrow();
  });
});

describe('TwilioWebhookService.cancelAppointment', () => {
  it('cancels appointment and sends WhatsApp reply', async () => {
    mockPrisma.$transaction.mockResolvedValue([]);
    mockSendWhatsAppFreeForm.mockResolvedValue({} as never);

    const reminder = { id: 'rem-1', appointmentId: 'appt-1' } as Parameters<typeof service.cancelAppointment>[0];
    await service.cancelAppointment(reminder, '+15551234567');

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockSendWhatsAppFreeForm).toHaveBeenCalledWith('+15551234567', expect.stringContaining('cancelada'));
  });

  it('succeeds even if WhatsApp reply fails', async () => {
    mockPrisma.$transaction.mockResolvedValue([]);
    mockSendWhatsAppFreeForm.mockRejectedValue(new Error('Twilio error'));

    const reminder = { id: 'rem-1', appointmentId: 'appt-1' } as Parameters<typeof service.cancelAppointment>[0];
    await expect(service.cancelAppointment(reminder, '+15551234567')).resolves.not.toThrow();
  });
});

describe('TwilioWebhookService.notifyUserOfStatusUpdate', () => {
  const fakeAppointment = {
    id: 'appt-1',
    startAt: new Date('2024-06-15T10:00:00Z'),
    patient: {
      name: 'John',
      lastName: 'Doe',
      user: {
        id: 'user-1',
        displayName: 'Dr. Smith',
        reminderActive: true,
        reminderChannel: 'WHATSAPP',
        whatsappNumber: '+15559876543',
        phoneNumber: '+15551112222',
      },
    },
  };

  it('sends WhatsApp notification when user has WhatsApp channel', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue(fakeAppointment);
    mockSendWhatsApp.mockResolvedValue({} as never);

    await service.notifyUserOfStatusUpdate('appt-1', 'CONFIRMED');

    expect(mockSendWhatsApp).toHaveBeenCalledWith(expect.objectContaining({
      to: '+15559876543',
      contentSid: 'status-update-sid',
    }));
  });

  it('sends SMS notification when user has SMS channel', async () => {
    const smsAppointment = {
      ...fakeAppointment,
      patient: { ...fakeAppointment.patient, user: { ...fakeAppointment.patient.user, reminderChannel: 'SMS' } },
    };
    mockPrisma.appointment.findUnique.mockResolvedValue(smsAppointment);
    mockSendSms.mockResolvedValue({} as never);

    await service.notifyUserOfStatusUpdate('appt-1', 'CONFIRMED');

    expect(mockSendSms).toHaveBeenCalledWith(expect.objectContaining({ to: '+15551112222' }));
  });

  it('skips notification when user has reminderActive=false', async () => {
    const inactiveAppointment = {
      ...fakeAppointment,
      patient: { ...fakeAppointment.patient, user: { ...fakeAppointment.patient.user, reminderActive: false } },
    };
    mockPrisma.appointment.findUnique.mockResolvedValue(inactiveAppointment);

    await service.notifyUserOfStatusUpdate('appt-1', 'CONFIRMED');

    expect(mockSendWhatsApp).not.toHaveBeenCalled();
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it('skips WhatsApp when user has no whatsappNumber', async () => {
    const noNumberAppointment = {
      ...fakeAppointment,
      patient: { ...fakeAppointment.patient, user: { ...fakeAppointment.patient.user, whatsappNumber: null } },
    };
    mockPrisma.appointment.findUnique.mockResolvedValue(noNumberAppointment);

    await service.notifyUserOfStatusUpdate('appt-1', 'CONFIRMED');

    expect(mockSendWhatsApp).not.toHaveBeenCalled();
  });

  it('returns early when appointment not found', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue(null);

    await service.notifyUserOfStatusUpdate('bad-id', 'CONFIRMED');

    expect(mockSendWhatsApp).not.toHaveBeenCalled();
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it('skips SMS when user has no phoneNumber', async () => {
    const noPhoneAppointment = {
      ...fakeAppointment,
      patient: { ...fakeAppointment.patient, user: { ...fakeAppointment.patient.user, reminderChannel: 'SMS', phoneNumber: null } },
    };
    mockPrisma.appointment.findUnique.mockResolvedValue(noPhoneAppointment);

    await service.notifyUserOfStatusUpdate('appt-1', 'CONFIRMED');

    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it('sends CANCELLED status text as cancelado', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue(fakeAppointment);
    mockSendWhatsApp.mockResolvedValue({} as never);

    await service.notifyUserOfStatusUpdate('appt-1', 'CANCELLED');

    expect(mockSendWhatsApp).toHaveBeenCalledWith(expect.objectContaining({
      contentVariables: expect.objectContaining({ '3': 'cancelado' }),
    }));
  });

  it('returns early when appointment has no patient relation', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue({ id: 'appt-1', patient: null });

    await service.notifyUserOfStatusUpdate('appt-1', 'CONFIRMED');

    expect(mockSendWhatsApp).not.toHaveBeenCalled();
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it('returns early when appointment has patient but no user relation', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue({ id: 'appt-1', patient: { name: 'J' } });

    await service.notifyUserOfStatusUpdate('appt-1', 'CONFIRMED');

    expect(mockSendWhatsApp).not.toHaveBeenCalled();
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it('rethrows errors', async () => {
    mockPrisma.appointment.findUnique.mockRejectedValue(new Error('DB error'));

    await expect(service.notifyUserOfStatusUpdate('appt-1', 'CONFIRMED')).rejects.toThrow('DB error');
  });
});

describe('TwilioWebhookService.sendErrorMessage', () => {
  it('sends error message to phone number', async () => {
    mockSendWhatsAppFreeForm.mockResolvedValue({} as never);
    await service.sendErrorMessage('+15551234567');
    expect(mockSendWhatsAppFreeForm).toHaveBeenCalledWith('+15551234567', expect.any(String));
  });

  it('does not throw when sending fails', async () => {
    mockSendWhatsAppFreeForm.mockRejectedValue(new Error('fail'));
    await expect(service.sendErrorMessage('+15551234567')).resolves.not.toThrow();
  });
});

describe('TwilioWebhookService.processWhatsAppReply', () => {
  it('processes a confirm intent successfully', async () => {
    mockPrisma.reminder.findFirst.mockResolvedValue({
      id: 'rem-1', appointmentId: 'appt-1', status: 'PENDING',
      appointment: { status: 'SCHEDULED' },
    });
    mockPrisma.$transaction.mockResolvedValue([]);
    mockSendWhatsAppFreeForm.mockResolvedValue({} as never);
    mockPrisma.appointment.findUnique.mockResolvedValue({
      id: 'appt-1', startAt: new Date(), patient: { name: 'J', lastName: 'D', user: { displayName: 'Dr', reminderActive: true, reminderChannel: 'WHATSAPP', whatsappNumber: '+1' } },
    });

    const result = await service.processWhatsAppReply({
      from: 'whatsapp:+15551234567',
      buttonPayload: 'confirm',
    });

    expect(result.success).toBe(true);
  });

  it('returns failure when payload is invalid', async () => {
    const result = await service.processWhatsAppReply({});
    expect(result.success).toBe(false);
  });

  it('returns failure when intent is unrecognised', async () => {
    mockSendWhatsAppFreeForm.mockResolvedValue({} as never);
    const result = await service.processWhatsAppReply({
      from: 'whatsapp:+15551234567',
      buttonPayload: 'maybe',
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe('Unknown intent');
  });

  it('returns failure when no active reminder found', async () => {
    mockPrisma.reminder.findFirst.mockResolvedValue(null);
    mockSendWhatsAppFreeForm.mockResolvedValue({} as never);
    const result = await service.processWhatsAppReply({
      from: 'whatsapp:+15551234567',
      buttonPayload: 'confirm',
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe('No active reminder found');
  });

  it('sends error message when validation fails with a phone number', async () => {
    mockSendWhatsAppFreeForm.mockResolvedValue({} as never);
    const result = await service.processWhatsAppReply({
      from: 'whatsapp:+15551234567',
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe('Missing phone number or button payload');
  });

  it('sends error message when confirm transaction fails', async () => {
    mockPrisma.reminder.findFirst.mockResolvedValue({
      id: 'rem-1', appointmentId: 'appt-1', status: 'PENDING',
      appointment: { status: 'SCHEDULED' },
    });
    mockPrisma.$transaction.mockRejectedValue(new Error('DB timeout'));
    mockSendWhatsAppFreeForm.mockResolvedValue({} as never);

    const result = await service.processWhatsAppReply({
      from: 'whatsapp:+15551234567',
      buttonPayload: 'confirm',
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Internal error');
    expect(mockSendWhatsAppFreeForm).toHaveBeenCalledWith('+15551234567', expect.any(String));
  });

  it('sends error message when cancel transaction fails', async () => {
    mockPrisma.reminder.findFirst.mockResolvedValue({
      id: 'rem-1', appointmentId: 'appt-1', status: 'PENDING',
      appointment: { status: 'SCHEDULED' },
    });
    mockPrisma.$transaction.mockRejectedValue(new Error('DB timeout'));
    mockSendWhatsAppFreeForm.mockResolvedValue({} as never);

    const result = await service.processWhatsAppReply({
      from: 'whatsapp:+15551234567',
      buttonPayload: 'cancel',
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Internal error');
  });

  it('returns success when notifyUserOfStatusUpdate throws after confirm', async () => {
    mockPrisma.reminder.findFirst.mockResolvedValue({
      id: 'rem-1', appointmentId: 'appt-1', status: 'PENDING',
      appointment: { status: 'SCHEDULED' },
    });
    mockPrisma.$transaction.mockResolvedValue([]);
    mockSendWhatsAppFreeForm.mockResolvedValue({} as never);
    mockPrisma.appointment.findUnique.mockRejectedValue(new Error('DB error'));

    const result = await service.processWhatsAppReply({
      from: 'whatsapp:+15551234567',
      buttonPayload: 'confirm',
    });

    expect(result.success).toBe(true);
  });

  it('returns success when notifyUserOfStatusUpdate throws after cancel', async () => {
    mockPrisma.reminder.findFirst.mockResolvedValue({
      id: 'rem-1', appointmentId: 'appt-1', status: 'PENDING',
      appointment: { status: 'SCHEDULED' },
    });
    mockPrisma.$transaction.mockResolvedValue([]);
    mockSendWhatsAppFreeForm.mockResolvedValue({} as never);
    mockPrisma.appointment.findUnique.mockRejectedValue(new Error('DB error'));

    const result = await service.processWhatsAppReply({
      from: 'whatsapp:+15551234567',
      buttonPayload: 'cancel',
    });

    expect(result.success).toBe(true);
  });
});
