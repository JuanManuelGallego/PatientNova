import { Router, type Request, type Response } from 'express';

import { ok } from '../utils/api/api-utils.js';
import { sendSms, sendWhatsApp } from './client.js';
import { resolveTwilioError } from './twilio-errors.js';
import { sendSmsSchema, sendWhatsAppSchema } from '../utils/validation/middleware.js';
import { reminderService } from '../reminders/reminder.service.js';
import { Channel, ReminderMode, ReminderStatus } from '../../generated/prisma/client.ts';
import { validateBody } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import { patientService } from '../patients/patient.service.js';
import { logger } from '../utils/api/logger.js';

export const notifyRouter = Router();

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
