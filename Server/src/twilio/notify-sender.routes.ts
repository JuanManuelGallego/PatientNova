import { Router, type Request, type Response } from 'express';

import { ok } from '../utils/api/api-utils.js';
import { sendSms, sendWhatsApp } from './client.js';
import { resolveTwilioError } from './twilio-errors.js';
import { sendSmsSchema, sendWhatsAppSchema, bulkSendSchema } from '../utils/validation/middleware.js';
import { reminderService } from '../reminders/reminder.service.js';
import { Channel, ReminderMode, ReminderStatus } from '../../generated/prisma/client.ts';
import { validateBody } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import { patientService } from '../patients/patient.service.js';
import { logger } from '../utils/api/logger.js';
import { getBoss } from '../scheduler/pg-boss.js';
import { BULK_TEMPLATE_CONFIG } from './bulk-template-config.js';
import { BULK_SEND_STAGGER_MS, BULK_SEND_CHUNK_SIZE } from '../utils/config/constants.js';
import { apiError } from '../utils/api/api-utils.js';
import { prisma } from '../utils/prisma/prisma-client.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { EntityType, ActionType } from '../../generated/prisma/enums.ts';

export const notifyRouter = Router();

/**
 * Replaces {{N}} placeholders in an SMS body with per-patient values.
 * Unresolved placeholders are left as-is (surfaces as an obvious gap in the
 * final message instead of silently dropping content).
 */
function renderSmsBody(body: string, contentVariables: Record<string, string>): string {
  return body.replace(/\{\{(\d+)\}\}/g, (match, key: string) => contentVariables[key] ?? match);
}

/**
 * POST /notify/whatsapp
 * Send an immediate WhatsApp message.
 */
notifyRouter.post(
  '/whatsapp',
  validateBody(sendWhatsAppSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (req.body.patientId) {
      await patientService.verifyOwnership(req.body.patientId, req.user!.id);
    }

    const reminder = await reminderService.create({
      channel: Channel.WHATSAPP,
      contentSid: req.body.contentSid,
      contentVariables: req.body.contentVariables,
      sendMode: ReminderMode.IMMEDIATE,
      patientId: req.body.patientId,
      sendAt: new Date(),
      status: ReminderStatus.PENDING,
      to: req.body.to,
    }, req.user!.id, false);

    try {
      const result = await sendWhatsApp(req.body);
      await reminderService.update(reminder.id, {
        status: ReminderStatus.QUEUED,
        messageId: result.messageSid ?? undefined,
      }, req.user!.id);
      ok(res, result, 201);
    } catch (err) {
      logger.error({ reminderId: reminder.id, channel: 'WHATSAPP', to: req.body.to, error: err instanceof Error ? err.message : err }, 'WhatsApp send failed');
      const twilioCode = typeof err === 'object' && err !== null && 'code' in err ? (err as { code: number }).code : undefined;
      await reminderService.update(reminder.id, {
        status: ReminderStatus.FAILED,
        error: resolveTwilioError(twilioCode, err instanceof Error ? err.message : 'Unknown send error'),
      }, req.user!.id);
      throw err;
    }
  })
);

/**
 * POST /notify/sms
 * Send an immediate SMS.
 */
notifyRouter.post(
  '/sms',
  validateBody(sendSmsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (req.body.patientId) {
      await patientService.verifyOwnership(req.body.patientId, req.user!.id);
    }

    const reminder = await reminderService.create({
      channel: Channel.SMS,
      body: req.body.body,
      sendMode: ReminderMode.IMMEDIATE,
      patientId: req.body.patientId,
      sendAt: new Date(),
      status: ReminderStatus.PENDING,
      to: req.body.to,
    }, req.user!.id, false);

    try {
      const result = await sendSms(req.body);
      await reminderService.update(reminder.id, {
        status: ReminderStatus.QUEUED,
        messageId: result.messageSid ?? undefined,
      }, req.user!.id);
      ok(res, result, 201);
    } catch (err) {
      logger.error({ reminderId: reminder.id, channel: 'SMS', to: req.body.to, error: err instanceof Error ? err.message : err }, 'SMS send failed');
      const twilioCode = typeof err === 'object' && err !== null && 'code' in err ? (err as { code: number }).code : undefined;
      await reminderService.update(reminder.id, {
        status: ReminderStatus.FAILED,
        error: resolveTwilioError(twilioCode, err instanceof Error ? err.message : 'Unknown send error'),
      }, req.user!.id);
      throw err;
    }
  })
);

/**
 * POST /notify/bulk
 * Send bulk messages to multiple patients via pg-boss queue with throttling.
 */
notifyRouter.post(
  '/bulk',
  validateBody(bulkSendSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { channel, templateKey, patientIds, sendMode, sendAt, sharedVariables, body } = req.body;
    const userId = req.user!.id;

    const templateConfig = BULK_TEMPLATE_CONFIG[templateKey];
    if (!templateConfig) {
      apiError(res, `Template "${templateKey}" not found`, 400);
      return;
    }
    if (!templateConfig.canBulkSend) {
      apiError(res, `Template "${templateKey}" is not enabled for bulk send`, 403);
      return;
    }

    // Fail fast (503) before any writes when the scheduler is not running, so
    // we never leave reminders behind that can't be enqueued.
    let boss;
    try {
      boss = getBoss();
    } catch {
      logger.warn({ userId }, 'Bulk send refused — pg-boss not initialized');
      apiError(res, 'Scheduler is not enabled — bulk send cannot be enqueued', 503);
      return;
    }

    // Resolve patients and build reminder DTOs before any writes
    type ReminderDto = {
      channel: Channel;
      contentSid: string | null;
      contentVariables: Record<string, string>;
      body?: string;
      sendMode: ReminderMode;
      patientId: string;
      sendAt: Date;
      status: ReminderStatus;
      to: string;
      patientName: string;
    };
    const reminderDtos: ReminderDto[] = [];
    const skippedPatientIds: string[] = [];

    // De-duplicate patient IDs (order-preserving) so a single request can
    // never create duplicate reminders for the same patient.
    const uniquePatientIds = [...new Set<string>(patientIds)];
    const isSms = channel === Channel.SMS;

    for (const patientId of uniquePatientIds) {
      let patient;
      try {
        patient = await patientService.findById(patientId, userId);
      } catch (e) {
        logger.warn({ patientId, error: e instanceof Error ? e.message : e }, 'Bulk send skipped — patient not found or not owned by user');
        skippedPatientIds.push(patientId);
        continue;
      }

      const to = isSms
        ? patient.smsNumber
        : channel === Channel.WHATSAPP
          ? patient.whatsappNumber
          : null;

      if (!to) {
        logger.warn({ patientId, channel }, 'Bulk send skipped — patient has no number for channel');
        skippedPatientIds.push(patientId);
        continue;
      }

      const patientName = `${patient.name} ${patient.lastName}`;
      // patient-specific variables win over shared variables
      const contentVariables: Record<string, string> = {
        ...(sharedVariables || {}),
        '1': patientName,
      };

      reminderDtos.push({
        channel,
        contentSid: isSms ? null : templateConfig.contentSid,
        contentVariables,
        ...(isSms ? { body: renderSmsBody(body, contentVariables) } : {}),
        sendMode,
        patientId,
        sendAt: sendMode === ReminderMode.SCHEDULED ? new Date(sendAt) : new Date(),
        status: ReminderStatus.PENDING,
        to,
        patientName,
      });
    }

    // Create all reminders in a single transaction, with a CREATE audit entry
    // per reminder (mirrors reminderService.create).
    const createdReminders = await prisma.$transaction(async (tx) => {
      const results: { id: string; sendAt: Date }[] = [];
      for (const dto of reminderDtos) {
        const reminder = await tx.reminder.create({
          data: {
            channel: dto.channel,
            contentSid: dto.contentSid,
            contentVariables: dto.contentVariables,
            body: dto.body ?? null,
            sendMode: dto.sendMode,
            patientId: dto.patientId,
            userId,
            sendAt: dto.sendAt,
            status: dto.status,
            to: dto.to,
          },
          select: { id: true, sendAt: true },
        });
        await logAudit({
          entityType: EntityType.REMINDER,
          entityId: reminder.id,
          actionType: ActionType.CREATE,
          description: `Envío masivo: recordatorio creado para ${dto.patientName}`,
          affectedFields: ['channel', 'contentSid', 'contentVariables', 'body', 'sendMode', 'sendAt', 'to'],
          fieldsAfter: {
            channel: dto.channel,
            contentSid: dto.contentSid,
            contentVariables: dto.contentVariables,
            body: dto.body ?? null,
            sendMode: dto.sendMode,
            sendAt: dto.sendAt.toISOString(),
            to: dto.to,
          },
          tx,
        });
        results.push({ id: reminder.id, sendAt: reminder.sendAt });
      }
      return results;
    });

    // Enqueue jobs in chunks, staggered from each reminder's own sendAt so
    // SCHEDULED sends fire at the requested time (not immediately).
    try {
      const chunks = Array.from(
        { length: Math.ceil(createdReminders.length / BULK_SEND_CHUNK_SIZE) },
        (_, i) => createdReminders.slice(i * BULK_SEND_CHUNK_SIZE, (i + 1) * BULK_SEND_CHUNK_SIZE),
      );
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex]!;
        const chunkStart = chunkIndex * BULK_SEND_CHUNK_SIZE;
        await Promise.all(
          chunk.map((r, i) => {
            const globalIndex = chunkStart + i;
            const startAfter = new Date(r.sendAt.getTime() + globalIndex * BULK_SEND_STAGGER_MS);
            return boss.send('bulk-send-message', { reminderId: r.id }, { startAfter });
          }),
        );
      }
    } catch (err) {
      // Never leave PENDING reminders without a queued job: mark them FAILED
      // so they surface in the UI instead of silently never sending.
      logger.error({
        userId,
        count: createdReminders.length,
        error: err instanceof Error ? err.message : err,
      }, 'Bulk send enqueue failed — marking created reminders FAILED');
      await prisma.reminder.updateMany({
        where: { id: { in: createdReminders.map((r) => r.id) } },
        data: { status: ReminderStatus.FAILED, error: 'Enqueue failed — message was not sent' },
      });
      throw err;
    }

    logger.info({ userId, channel, templateKey, count: createdReminders.length, skipped: skippedPatientIds.length }, 'Bulk send job enqueued');

    ok(res, {
      totalCount: uniquePatientIds.length,
      queuedCount: createdReminders.length,
      skippedCount: skippedPatientIds.length,
      skippedPatientIds,
      channel,
      templateKey,
    }, 201);
  })
);
