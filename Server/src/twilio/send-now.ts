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
  | { channel: typeof Channel.WHATSAPP; to: string; contentSid: string; contentVariables?: Record<string, string>; patientId?: string }
  | { channel: typeof Channel.SMS; to: string; body: string; patientId?: string }
  | { channel: typeof Channel.EMAIL; to: string; body: string; subject?: string; patientId?: string };

function twilioCodeOf(err: unknown): number | undefined {
  return typeof err === 'object' && err !== null && 'code' in err ? (err as { code: number }).code : undefined;
}

async function deliver(message: ImmediateMessage): Promise<NotificationResult> {
  switch (message.channel) {
    case Channel.WHATSAPP: {
      const result = await sendWhatsApp(message);
      if (!result.success) throw new Error(resolveTwilioError(result.errorCode, result.error ?? 'WhatsApp send failed'));
      return result;
    }
    case Channel.SMS: {
      const result = await sendSms(message);
      if (!result.success) throw new Error(resolveTwilioError(result.errorCode, result.error ?? 'SMS send failed'));
      return result;
    }
    case Channel.EMAIL: {
      const result = await sendEmail(message);
      if (!result.success) throw new Error(result.error ?? 'Email send failed');
      return result;
    }
  }
}

/**
 * Sends one message now and keeps its reminder row in step: PENDING before the send, QUEUED with the provider's
 * message id after it, FAILED (plus the provider's failure alert) when it fails, and the error rethrown.
 */
export async function sendNow(message: ImmediateMessage, userId: string): Promise<{ reminderId: string; result: NotificationResult }> {
  // The notify routes accept a message with no patient, as they always have; the DTO type assumes one.
  const dto = {
    channel: message.channel,
    ...(message.channel === Channel.WHATSAPP
      ? { contentSid: message.contentSid, contentVariables: message.contentVariables }
      : { body: message.body }),
    ...(message.channel === Channel.EMAIL && { subject: message.subject }),
    sendMode: ReminderMode.IMMEDIATE,
    patientId: message.patientId,
    sendAt: new Date(),
    status: ReminderStatus.PENDING,
    to: message.to,
  } as CreateReminderDto;
  const reminder = await reminderService.create(dto, userId, false);

  try {
    const result = await deliver(message);
    await reminderService.update(reminder.id, { status: ReminderStatus.QUEUED, messageId: result.messageSid ?? undefined }, userId);
    return { reminderId: reminder.id, result };
  } catch (err) {
    const maskedTo = message.channel === Channel.EMAIL ? maskEmail(message.to) : maskPhone(message.to);
    logger.error(
      { reminderId: reminder.id, channel: message.channel, maskedTo, error: err instanceof Error ? err.message : err },
      `${message.channel === Channel.EMAIL ? 'Email' : message.channel === Channel.SMS ? 'SMS' : 'WhatsApp'} send failed`,
    );
    const error = message.channel === Channel.EMAIL
      ? (err instanceof Error ? err.message : 'Unknown send error')
      : resolveTwilioError(twilioCodeOf(err), err instanceof Error ? err.message : 'Unknown send error');
    await reminderService.update(reminder.id, { status: ReminderStatus.FAILED, error }, userId);
    await sendReminderFailureAlert(reminder.id);
    throw err;
  }
}
