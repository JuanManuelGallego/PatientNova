import { Channel } from '../../generated/prisma/client.ts';
import { dispatchMessage } from '../scheduler/dispatch.js';
import { prisma } from '../utils/prisma/prisma-client.js';
import { config } from '../utils/config/config.ts';
import { logger } from '../utils/api/logger.js';

function fullName(firstName: string | null, lastName: string | null): string {
  return `${firstName ?? ''} ${lastName ?? ''}`.trim();
}

/**
 * Sends a best-effort alert to the reminder owner without creating another
 * Reminder record, which prevents an alert failure from becoming recursive.
 */
export async function sendReminderFailureAlert(reminderId: string): Promise<void> {
  try {
    const reminder = await prisma.reminder.findUnique({
      where: { id: reminderId },
      select: {
        user: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            reminderActive: true,
            reminderChannel: true,
            whatsappNumber: true,
            phoneNumber: true,
          },
        },
        patient: {
          select: { name: true, lastName: true },
        },
      },
    });

    if (!reminder) {
      logger.warn({ reminderId }, 'Reminder failure alert skipped — reminder not found');
      return;
    }

    const { user, patient } = reminder;
    if (!user.reminderActive) {
      logger.debug({ reminderId, userId: user.id }, 'Reminder failure alert skipped — user alerts disabled');
      return;
    }

    const userName = user.displayName?.trim() || fullName(user.firstName, user.lastName);
    const patientName = fullName(patient.name, patient.lastName);
    const isWhatsApp = user.reminderChannel === Channel.WHATSAPP;
    const to = isWhatsApp ? user.whatsappNumber : user.phoneNumber;

    if (!to) {
      logger.warn(
        { reminderId, userId: user.id, channel: user.reminderChannel },
        'Reminder failure alert skipped — user has no contact number for channel',
      );
      return;
    }

    const result = await dispatchMessage(user.reminderChannel, isWhatsApp
      ? {
          to,
          contentSid: config.twilio.reminderFailedSid,
          contentVariables: { '1': userName, '2': patientName },
        }
      : {
          to,
          body: `Hola, ${userName}.\n\nLe informamos que el recordatorio del paciente ${patientName} falló. Por favor, verifique la información en el sistema.\n\nFeliz día`,
        });

    if (!result.success) {
      logger.error(
        { reminderId, userId: user.id, channel: user.reminderChannel, error: result.error },
        'Reminder failure alert was not sent',
      );
      return;
    }

    logger.info(
      { reminderId, userId: user.id, channel: user.reminderChannel, messageId: result.messageSid },
      'Reminder failure alert sent',
    );
  } catch (error) {
    logger.error({ reminderId, error }, 'Reminder failure alert could not be sent');
  }
}
