import { Channel, ReminderMode, ReminderStatus } from '../../generated/prisma/client.ts';
import { sendEmail } from '../brevo/email-client.js';
import { reminderService } from '../reminders/reminder.service.js';
import type { CreateReminderDto } from '../reminders/reminder.schemas.js';
import { sendReminderFailureAlert } from '../reminders/reminder-failure-alert.js';
import { logger, maskEmail, maskPhone } from '../utils/api/logger.js';
import { sendSms, sendWhatsApp } from './client.js';
import { resolveTwilioError } from './twilio-errors.js';
import type { NotificationResult } from './types.js';

export type ImmediateMessage =
  | { channel: typeof Channel.WHATSAPP; to: string; contentSid: string; contentVariables?: Record<string, string>; patientId: string }
  | { channel: typeof Channel.SMS; to: string; body: string; patientId: string }
  | { channel: typeof Channel.EMAIL; to: string; body: string; subject?: string; patientId: string };

const CHANNELS: Record<Channel, { label: string; mask: (to: string) => string; describe: (code: number | null | undefined, message: string) => string }> = {
  [ Channel.WHATSAPP ]: { label: 'WhatsApp', mask: maskPhone, describe: resolveTwilioError },
  [ Channel.SMS ]: { label: 'SMS', mask: maskPhone, describe: resolveTwilioError },
  [ Channel.EMAIL ]: { label: 'Email', mask: maskEmail, describe: (_code, message) => message },
};

function twilioCodeOf(err: unknown): number | undefined {
  return typeof err === 'object' && err !== null && 'code' in err ? (err as { code: number }).code : undefined;
}

function deliver(message: ImmediateMessage): Promise<NotificationResult> {
  switch (message.channel) {
    case Channel.WHATSAPP: return sendWhatsApp(message);
    case Channel.SMS: return sendSms(message);
    case Channel.EMAIL: return sendEmail(message);
  }
}

function reminderOf(message: ImmediateMessage): CreateReminderDto {
  const base = {
    sendMode: ReminderMode.IMMEDIATE,
    sendAt: new Date(),
    status: ReminderStatus.PENDING,
    to: message.to,
    patientId: message.patientId,
  };
  switch (message.channel) {
    case Channel.WHATSAPP:
      return { ...base, channel: message.channel, contentSid: message.contentSid, contentVariables: message.contentVariables };
    case Channel.SMS:
      return { ...base, channel: message.channel, body: message.body };
    case Channel.EMAIL:
      return { ...base, channel: message.channel, body: message.body, subject: message.subject };
  }
}

export async function sendNow(message: ImmediateMessage, userId: string): Promise<{ reminderId: string; result: NotificationResult }> {
  const channel = CHANNELS[ message.channel ];
  const reminder = await reminderService.create(reminderOf(message), userId, false);

  try {
    const result = await deliver(message);
    if (!result.success) throw new Error(channel.describe(result.errorCode, result.error ?? `${channel.label} send failed`));
    await reminderService.update(reminder.id, { status: ReminderStatus.QUEUED, messageId: result.messageSid ?? undefined }, userId);
    return { reminderId: reminder.id, result };
  } catch (err) {
    logger.error(
      { reminderId: reminder.id, channel: message.channel, maskedTo: channel.mask(message.to), error: err instanceof Error ? err.message : err },
      `${channel.label} send failed`,
    );
    const error = channel.describe(twilioCodeOf(err), err instanceof Error ? err.message : 'Unknown send error');
    await reminderService.update(reminder.id, { status: ReminderStatus.FAILED, error }, userId);
    await sendReminderFailureAlert(reminder.id);
    throw err;
  }
}
