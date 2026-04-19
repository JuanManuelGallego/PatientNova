import { Router, type Request, type Response } from 'express';

import { ok } from '../utils/apiUtils.js';
import { sendSms, sendWhatsApp } from '../twilio/twilioClient.js';
import { sendSmsSchema, sendWhatsAppSchema } from '../utils/validation.js';
import { reminderRepository } from '../reminders/reminder.repository.js';
import { Channel } from '@prisma/client';
import { ReminderMode, ReminderStatus } from '@prisma/client';
import { validateBody } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { patientService } from '../patients/patient.service.js';

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

    const result = await sendWhatsApp(req.body);
    await reminderRepository.create({
      channel: Channel.WHATSAPP,
      contentSid: req.body.contentSid,
      contentVariables: req.body.contentVariables,
      messageId: result.messageSid,
      sendMode: ReminderMode.IMMEDIATE,
      patientId: req.body.patientId,
      sendAt: new Date(),
      status: ReminderStatus.SENT,
      to: req.body.to,
    }, req.user!.id);
    ok(res, result, 201);
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

    const result = await sendSms(req.body);
    await reminderRepository.create({
      channel: Channel.SMS,
      body: req.body.body,
      messageId: result.messageSid,
      sendMode: ReminderMode.IMMEDIATE,
      patientId: req.body.patientId,
      sendAt: new Date(),
      status: ReminderStatus.SENT,
      to: req.body.to,
    }, req.user!.id);
    ok(res, result, 201);
  })
);
