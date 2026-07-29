import { ReminderMode, ReminderStatus, type Reminder } from '../../generated/prisma/client.ts';
import { fromPrisma } from 'pg-boss';
import { prisma } from '../utils/prisma/prisma-client.js';
import { reminderRepository } from './reminder.repository.js';
import { ReminderNotCancellableError, PatientNotFoundError } from '../utils/errors/errors.js';
import { ReminderSendAtInPastError, ReminderNotRetryableError } from './reminder.errors.js';
import { logger } from '../utils/api/logger.js';
import { reminderInclude } from './reminder.types.js';
import type { CreateReminderDto, UpdateReminderDto, ListRemindersQuery, ReminderStatsQuery } from './reminder.schemas.js';
import type { Paginated } from '../utils/api/pagination.js';
import type { ReminderWithRelations, ReminderStats } from './reminder.types.js';
import { getBoss } from '../scheduler/pg-boss.js';
import { reminderJobManager } from '../scheduler/reminder-job-manager.js';

const QUEUE = 'send-reminder';

export const reminderService = {
  findById: reminderRepository.findById.bind(reminderRepository),

  async findMany(query: ListRemindersQuery, userId: string): Promise<Paginated<ReminderWithRelations>> {
    return reminderRepository.findMany(query, userId);
  },

  async getStats(query: ReminderStatsQuery, userId: string): Promise<ReminderStats> {
    return reminderRepository.getStats(query, userId);
  },

  async create(dto: CreateReminderDto, userId: string, enqueue = true): Promise<Reminder> {
    if (dto.sendMode === ReminderMode.SCHEDULED) {
      if (!dto.sendAt || new Date(dto.sendAt) <= new Date()) {
        throw new ReminderSendAtInPastError();
      }
    }

    const reminder = await prisma.$transaction(async (tx) => {
      const patient = await tx.patient.findFirst({ where: { id: dto.patientId, userId } });
      if (!patient) throw new PatientNotFoundError(dto.patientId);

      const created = await tx.reminder.create({
        data: {
          channel: dto.channel,
          contentSid: dto.contentSid || null,
          ...(dto.contentVariables && { contentVariables: dto.contentVariables }),
          messageId: dto.messageId || null,
          sendMode: dto.sendMode,
          patientId: dto.patientId,
          userId,
          appointmentId: dto.appointmentId || null,
          sendAt: new Date(dto.sendAt),
          status: dto.status ?? ReminderStatus.PENDING,
          to: dto.to,
          body: dto.body || null,
        },
        include: reminderInclude,
      });

      if (enqueue) {
        const boss = getBoss();
        const db = fromPrisma(tx);
        if (dto.sendMode === ReminderMode.IMMEDIATE) {
          await boss.send(QUEUE, { reminderId: created.id }, { db });
        } else {
          await boss.send(QUEUE, { reminderId: created.id }, { startAfter: new Date(dto.sendAt), db });
        }
      }

      return created;
    });

    logger.info({ reminderId: reminder.id, userId, mode: dto.sendMode, enqueued: enqueue }, 'Reminder created');
    return reminder;
  },

  async update(id: string, dto: UpdateReminderDto, userId: string): Promise<Reminder> {
    const reminder = await reminderRepository.findById(id, userId);

    if (dto.sendAt && reminder.status === ReminderStatus.PENDING) {
      await reminderJobManager.reschedule(id, new Date(dto.sendAt));
    }

    if (dto.sendMode === ReminderMode.IMMEDIATE && reminder.sendMode === ReminderMode.SCHEDULED) {
      if (reminder.status === ReminderStatus.PENDING) {
        await reminderJobManager.cancel(id);
        await reminderJobManager.enqueueImmediate(id);
      }
    }

    if (dto.status && dto.status !== ReminderStatus.PENDING) {
      await reminderJobManager.cancel(id);
    }

    const updated = await reminderRepository.update(id, dto, userId);
    logger.info({ reminderId: id, userId, fields: Object.keys(dto) }, 'Reminder updated');
    return updated;
  },

  async cancel(id: string, userId: string): Promise<Reminder> {
    const reminder = await reminderRepository.findById(id, userId);
    if (reminder.status !== ReminderStatus.PENDING) {
      throw new ReminderNotCancellableError(reminder.status);
    }
    await reminderJobManager.cancel(id);
    const cancelled = await reminderRepository.cancel(id, userId);
    logger.info({ reminderId: id, userId }, 'Reminder cancelled');
    return cancelled;
  },

  async softDelete(id: string, userId: string): Promise<Reminder> {
    const reminder = await reminderRepository.findById(id, userId);
    if (reminder.status === ReminderStatus.PENDING) {
      await reminderJobManager.cancel(id);
    }
    const deleted = await reminderRepository.delete(id, userId);
    logger.info({ reminderId: id, userId }, 'Reminder deleted');
    return deleted;
  },

  async restore(id: string, userId: string): Promise<Reminder> {
    const restored = await reminderRepository.restore(id, userId);

    if (restored.status === ReminderStatus.PENDING && new Date(restored.sendAt) > new Date()) {
      const hasJob = await reminderJobManager.hasQueuedJob(restored.id);
      if (!hasJob) {
        await reminderJobManager.enqueue(restored.id, new Date(restored.sendAt));
      }
    }

    logger.info({ reminderId: id, userId }, 'Reminder restored');
    return restored;
  },

  async retry(id: string, userId: string): Promise<Reminder> {
    const reminder = await reminderRepository.findById(id, userId);

    if (reminder.status !== ReminderStatus.FAILED) {
      throw new ReminderNotRetryableError(id, `status is "${reminder.status}", must be FAILED`);
    }

    if (reminder.isDeleted) {
      throw new ReminderNotRetryableError(id, 'reminder is deleted');
    }

    if (reminder.retryCount >= 1) {
      throw new ReminderNotRetryableError(id, 'max retries exceeded');
    }

    if (reminder.appointmentId) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: reminder.appointmentId },
        select: { startAt: true },
      });
      if (appointment && new Date(appointment.startAt) <= new Date()) {
        throw new ReminderNotRetryableError(id, 'linked appointment already passed');
      }
    }

    const now = new Date();
    const sendAt = new Date(reminder.sendAt) > now ? new Date(reminder.sendAt) : now;

    const retried = await reminderRepository.retry(id, userId, sendAt);

    if (sendAt > now) {
      await reminderJobManager.enqueue(id, sendAt);
    } else {
      await reminderJobManager.enqueueImmediate(id);
    }

    logger.info({ reminderId: id, userId, retryCount: retried.retryCount }, 'Reminder retried');
    return retried;
  },
};
