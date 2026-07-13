import { getBoss } from './pgBoss.js';
import { logger } from '../utils/logger.js';

const QUEUE = 'send-reminder';

export const reminderJobManager = {
  async enqueue(reminderId: string, sendAt: Date): Promise<void> {
    const boss = getBoss();
    await boss.send(QUEUE, { reminderId }, { startAfter: sendAt });
    logger.debug({ reminderId }, 'Enqueued reminder job');
  },

  async enqueueImmediate(reminderId: string): Promise<void> {
    const boss = getBoss();
    await boss.send(QUEUE, { reminderId });
    logger.debug({ reminderId }, 'Enqueued immediate reminder job');
  },

  async cancel(reminderId: string): Promise<void> {
    const boss = getBoss();
    const jobs = await boss.findJobs(QUEUE, { data: { reminderId }, queued: true });
    if (jobs.length > 0) {
      await boss.cancel(QUEUE, jobs.map((j) => j.id));
      logger.debug({ reminderId, count: jobs.length }, 'Cancelled reminder jobs');
    }
  },

  async reschedule(reminderId: string, newSendAt: Date): Promise<void> {
    // Simpler + more robust than boss.update(): cancel all queued jobs then
    // re-enqueue with the new sendAt. Avoids boss.update()'s created/retry-state
    // restriction and the non-idiomatic (name, data, options) overload.
    await reminderJobManager.cancel(reminderId);
    await reminderJobManager.enqueue(reminderId, newSendAt);
  },

  async hasQueuedJob(reminderId: string): Promise<boolean> {
    const boss = getBoss();
    const jobs = await boss.findJobs(QUEUE, { data: { reminderId }, queued: true });
    return jobs.length > 0;
  },
};
