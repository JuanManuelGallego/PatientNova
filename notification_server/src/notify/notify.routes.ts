import { Router, type Request, type Response } from 'express';

import { handleError, ok } from '../utils/apiUtils.js';
import { scheduleWhatsApp, sendSms, sendWhatsApp } from '../twillo/twilioClient.js';
import { scheduleSchema, sendSmsSchema, sendWhatsAppSchema, validate } from '../utils/validation.js';
import { reminderRepository } from '../reminders/reminder.repository.js';
import { Channel } from '../utils/types.js';
import { ReminderMode, ReminderStatus } from '@prisma/client';

export const notifyRouter = Router();

/**
 * POST /notify/whatsapp
 * Send an immediate WhatsApp message.
 *
 * Body (template):
 *   {
 *     "to": "+15551234567",
 *     "contentSid": "HXabc123",
 *     "contentVariables": { "1": "March 20", "2": "3:00 PM" }
 *   }
 */
notifyRouter.post(
  '/whatsapp',
  validate(sendWhatsAppSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await sendWhatsApp(req.body);
      reminderRepository.create({
        channel: Channel.WHATSAPP,
        contentSid: req.body.contentSid,
        mode: ReminderMode.IMMEDIATE,
        sendAt: new Date().toISOString(),
        status: ReminderStatus.SENT,
        to: req.body.to,
        messageId: result.messageSid,
        patientId: req.body.patientId,
        contentVariables: req.body.contentVariables,
      })
      ok(res, result, 201);
    } catch (err) {
      handleError(res, err);
    }
  }
);

/**
 * POST /notify/sms
 * Send an immediate SMS.
 *
 * Body:
 *   { "to": "+15551234567", "body": "Reminder: your appointment is tomorrow at 3 PM." }
 */
notifyRouter.post(
  '/sms',
  validate(sendSmsSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await sendSms(req.body);
      ok(res, result, 201);
    } catch (err) {
      handleError(res, err);
    }
  }
);

/**
 * POST /notify/schedule
 * Schedule a notification for a future time using Twillo Integration.
 *
 * Body:
 *   {
 *     "channel": "whatsapp" | "sms",
 *     "sendAt": "2026-03-20T15:00:00.000Z",
 *     "payload": { ...WhatsApp or SMS payload... }
 *   }
 */
notifyRouter.post(
  '/schedule',
  validate(scheduleSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await scheduleWhatsApp(req.body);
      reminderRepository.create({
        channel: req.body.channel,
        contentSid: req.body.contentSid,
        mode: ReminderMode.SCHEDULED,
        scheduledAt: new Date().toISOString(),
        sendAt: req.body.sendAt,
        status: ReminderStatus.PENDING,
        to: req.body.payload.to,
        patientId: req.body.patientId,
        messageId: result.messageSid,
      })

      ok(res, result, 201);
    } catch (err) {
      handleError(res, err);
    }
  }
);
