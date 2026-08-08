import { ReminderMode, ReminderStatus } from '../../generated/prisma/enums.ts';
import { prisma } from '../utils/prisma/prisma-client.js';
import { logger } from '../utils/api/logger.js';
import { getBoss } from './pg-boss.js';

const QUEUES = [ 'send-reminder', 'bulk-send-message' ] as const;
const FALLBACK_QUEUE = 'send-reminder';

export async function reconcileScheduledReminders(): Promise<void> {
    const reminders = await prisma.reminder.findMany({
        where: {
            sendMode: ReminderMode.SCHEDULED,
            status: ReminderStatus.PENDING,
            isDeleted: false,
        },
        select: {
            id: true,
            sendAt: true,
        },
    });

    const boss = getBoss();
    let existing = 0;
    let created = 0;
    let failed = 0;

    for (const reminder of reminders) {
        const jobs = (await Promise.all(QUEUES.map((queue) => boss.findJobs(queue, {
            data: { reminderId: reminder.id },
        })))).flat();

        if (jobs.some((job) => job.state === 'created' || job.state === 'retry' || job.state === 'active')) {
            existing++;
            continue;
        }

        try {
            await boss.send(FALLBACK_QUEUE, { reminderId: reminder.id }, {
                startAfter: reminder.sendAt,
            });
            created++;
        } catch (error) {
            failed++;
            logger.error({
                reminderId: reminder.id,
                error: error instanceof Error ? error.message : error,
            }, 'Failed to recreate scheduled reminder job');
        }
    }

    logger.info({
        scanned: reminders.length,
        existing,
        created,
        failed,
    }, 'Scheduled reminder reconciliation completed');
}