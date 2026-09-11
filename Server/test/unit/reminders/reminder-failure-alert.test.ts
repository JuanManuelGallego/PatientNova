import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from '../../../generated/prisma/client.ts';

const mocks = vi.hoisted(() => ({
  prisma: {
    reminder: { findUnique: vi.fn() },
  },
  dispatchMessage: vi.fn(),
  logAudit: vi.fn(),
  runInAuditContext: vi.fn((_: unknown, fn: () => unknown) => fn()),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../../src/utils/prisma/prisma-client.js', () => ({ prisma: mocks.prisma }));
vi.mock('../../../src/scheduler/dispatch.js', () => ({ dispatchMessage: mocks.dispatchMessage }));
vi.mock('../../../src/audit-log/audit-log.utils.js', () => ({ logAudit: mocks.logAudit }));
vi.mock('../../../src/audit-log/audit-log-context.js', () => ({ runInAuditContext: mocks.runInAuditContext }));
vi.mock('../../../src/utils/config/config.ts', () => ({
  config: { twilio: { reminderFailedSid: 'HXfailed' } },
}));
vi.mock('../../../src/utils/api/logger.js', () => ({ logger: mocks.logger }));

import { sendReminderFailureAlert } from '../../../src/reminders/reminder-failure-alert.js';

const reminderWithUser = {
  user: {
    id: 'user-1',
    displayName: 'Dr. Test User',
    firstName: 'Test',
    lastName: 'User',
    reminderActive: true,
    reminderChannel: Channel.WHATSAPP,
    whatsappNumber: '+57300123456',
    phoneNumber: '+57300987654',
  },
  patient: { name: 'Maria', lastName: 'Garcia' },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.reminder.findUnique.mockResolvedValue(reminderWithUser);
  mocks.dispatchMessage.mockResolvedValue({
    success: true,
    messageSid: 'SMalert',
    channel: Channel.WHATSAPP,
    to: '+57300123456',
  });
});

describe('sendReminderFailureAlert', () => {
  it('sends the WhatsApp failure template with the requested variables', async () => {
    await sendReminderFailureAlert('rem-1');

    expect(mocks.dispatchMessage).toHaveBeenCalledWith(Channel.WHATSAPP, {
      to: '+57300123456',
      contentSid: 'HXfailed',
      contentVariables: { '1': 'Dr. Test User', '2': 'Maria Garcia' },
    });
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'REMINDER',
      entityId: 'rem-1',
      actionType: 'UPDATE',
      source: 'JOB',
      userId: 'user-1',
      fieldsAfter: expect.objectContaining({
        failureAlertStatus: 'SENT',
        failureAlertChannel: Channel.WHATSAPP,
        failureAlertMessageId: 'SMalert',
      }),
    }));
  });

  it('sends the equivalent SMS when SMS is the configured channel', async () => {
    mocks.prisma.reminder.findUnique.mockResolvedValue({
      ...reminderWithUser,
      user: { ...reminderWithUser.user, reminderChannel: Channel.SMS },
    });

    await sendReminderFailureAlert('rem-1');

    expect(mocks.dispatchMessage).toHaveBeenCalledWith(Channel.SMS, {
      to: '+57300987654',
      body: expect.stringContaining('Maria Garcia'),
    });
  });

  it('does not send when the user has disabled reminders', async () => {
    mocks.prisma.reminder.findUnique.mockResolvedValue({
      ...reminderWithUser,
      user: { ...reminderWithUser.user, reminderActive: false },
    });

    await sendReminderFailureAlert('rem-1');

    expect(mocks.dispatchMessage).not.toHaveBeenCalled();
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({
      fieldsAfter: expect.objectContaining({ failureAlertStatus: 'SKIPPED' }),
    }));
  });

  it('does not send without a contact number for the configured channel', async () => {
    mocks.prisma.reminder.findUnique.mockResolvedValue({
      ...reminderWithUser,
      user: { ...reminderWithUser.user, whatsappNumber: null },
    });

    await sendReminderFailureAlert('rem-1');

    expect(mocks.dispatchMessage).not.toHaveBeenCalled();
  });

  it('swallows alert delivery errors', async () => {
    mocks.dispatchMessage.mockRejectedValue(new Error('Twilio unavailable'));

    await expect(sendReminderFailureAlert('rem-1')).resolves.toBeUndefined();
    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({
      fieldsAfter: expect.objectContaining({
        failureAlertStatus: 'FAILED',
        failureAlertError: 'Twilio unavailable',
      }),
    }));
  });

  it('audits a failed alert response', async () => {
    mocks.dispatchMessage.mockResolvedValue({
      success: false,
      error: 'Twilio rejected the message',
      channel: Channel.WHATSAPP,
      to: '+57300123456',
    });

    await sendReminderFailureAlert('rem-1');

    expect(mocks.logAudit).toHaveBeenCalledWith(expect.objectContaining({
      fieldsAfter: expect.objectContaining({
        failureAlertStatus: 'FAILED',
        failureAlertError: 'Twilio rejected the message',
      }),
    }));
  });
});
