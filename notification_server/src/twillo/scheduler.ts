import cron from 'node-cron';
import { ReminderStatus, Channel } from '@prisma/client';
import { prisma } from '../prisma/prismaClient.js';
import { logger } from '../utils/logger.js';
import { sendWhatsApp } from './twilioClient.js';
import { reminderRepository } from '../reminders/reminder.repository.js';

/**
 * Worker function that finds appointments needing reminders in the next minute
 * and sends the reminders via Twilio
 */
export async function reminderWorker(): Promise<void> {
  try {
    logger.info('Running reminder scheduler worker...')
    
    const now = new Date();
    const oneSecondAgo = new Date(now.getTime() - 1000); // Subtract 1 second to account for any slight delays in execution
    const oneMinuteFromNow = new Date(now.getTime() + 60 * 1000);
    const remindersToSend = await prisma.reminder.findMany({
      where: {
        status: ReminderStatus.PENDING,
        sendAt: {
          gte: oneSecondAgo,
          lte: oneMinuteFromNow,
        },
      },
      include: {
        patient: true,
      },
    });

    if (remindersToSend.length === 0) {
      logger.info('No reminders to send at this time');
      return;
    }

    logger.info(`Found ${remindersToSend.length} reminder(s) to send`);
    
    for (const reminder of remindersToSend) {
      try {
        
        let recipient = reminder.to;
        const channel = reminder.channel;

        
        if (!recipient && reminder.patient) {
          if (channel === Channel.WHATSAPP && reminder.patient.whatsappNumber) {
            recipient = reminder.patient.whatsappNumber;
          } else if (channel === Channel.SMS && reminder.patient.smsNumber) {
            recipient = reminder.patient.smsNumber;
          }
        }

        if (!recipient) {
          logger.warn(
            { reminderId: reminder.id, channel },
            `No recipient found for reminder with channel ${channel}`
          );
          await reminderRepository.update(reminder.id, {
            status: ReminderStatus.FAILED,
            error: `No recipient available for channel ${channel}`,
          });
          continue;
        }
        
        if (channel === Channel.WHATSAPP) {
          const result = await sendWhatsApp({
            to: recipient,
            contentSid: reminder.contentSid || '',
            ...(reminder.contentVariables && { contentVariables: reminder.contentVariables as Record<string, string> }),
          });

          if (result.success) {
            logger.info({ reminderId: reminder.id, messageSid: result.messageSid }, 'Reminder sent successfully');
            await reminderRepository.update(reminder.id, {
              status: ReminderStatus.SENT,
              messageId: result.messageSid,
              sendAt: new Date().toISOString(),
            });
          } else {
            logger.error({ reminderId: reminder.id }, 'Failed to send reminder');
            await reminderRepository.update(reminder.id, {
              status: ReminderStatus.FAILED,
              error: 'Failed to send WhatsApp message',
            });
          }
        } else if (channel === Channel.SMS) {
          logger.warn({ reminderId: reminder.id }, 'SMS channel not yet implemented');
          await reminderRepository.update(reminder.id, {
            status: ReminderStatus.FAILED,
            error: 'SMS channel not yet implemented',
          });
        } else if (channel === Channel.EMAIL) {
          logger.warn({ reminderId: reminder.id }, 'EMAIL channel not yet implemented');
          await reminderRepository.update(reminder.id, {
            status: ReminderStatus.FAILED,
            error: 'EMAIL channel not yet implemented',
          });
        }
      } catch (error) {
        logger.error({ reminderId: reminder.id, error }, 'Error processing reminder');
        try {
          await reminderRepository.update(reminder.id, {
            status: ReminderStatus.FAILED,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        } catch (updateError) {
          logger.error({ reminderId: reminder.id, updateError }, 'Failed to update reminder status');
        }
      }
    }
  } catch (error) {
    logger.error({ error }, 'Error in reminder scheduler worker');
  }
}

/**
 * Initialize the cron scheduler to run the reminder worker every minute
 */
export function initializeScheduler(): void {
  logger.info('Initializing reminder scheduler...');

  const task = cron.schedule('* * * * *', async () => {
    await reminderWorker();
  });

  logger.info('Reminder scheduler initialized - running every minute');
  (global as any).schedulerTask = task;
}

/**
 * Gracefully stop the scheduler
 */
export function stopScheduler(): void {
  const task = (global as any).schedulerTask;
  if (task) {
    task.stop();
    task.destroy();
    logger.info('Reminder scheduler stopped');
  }
}
