import { Router, type Request, type Response } from 'express';

import { handleError, ok } from '../utils/apiUtils.js';
import { scheduleWhatsApp, sendSms, sendWhatsApp } from '../twillo/twilioClient.js';
import { scheduleSchema, sendSmsSchema, sendWhatsAppSchema, validate } from '../utils/validation.js';
import { scheduleNotification, listJobs, getJob, cancelJob } from '../twillo/scheduler.js';
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
        to: req.body.payload.to,
        messageId: result.messageSid,
        patientId: req.body.patientId,
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
 * Schedule a notification for a future time.
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

/**
 * GET /notify/schedule
 * List all scheduled jobs, optionally filtered by status.
 *
 * Query params: ?status=pending|sent|failed|cancelled
 */
notifyRouter.get('/schedule', (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const allowed = [ 'pending', 'sent', 'failed', 'cancelled' ];
  if (status && !allowed.includes(status)) {
    handleError(res, new Error(`Invalid status filter. Allowed: ${allowed.join(', ')}`));
    return;
  }
  const jobs = listJobs(status as Parameters<typeof listJobs>[ 0 ]);
  ok(res, { count: jobs.length, jobs });
});

/**
 * GET /notify/schedule/:jobId
 * Get details for a specific scheduled job.
 */
notifyRouter.get('/schedule/:jobId', (req: Request, res: Response) => {
  const jobId = typeof req.params.jobId === 'string' ? req.params.jobId : undefined;
  if (!jobId) {
    handleError(res, new Error('Missing jobId parameter'));
    return;
  }

  const job = getJob(jobId);
  if (!job) {
    handleError(res, new Error(`Job "${jobId}" not found`));
    return;
  }
  ok(res, job);
});

/**
 * DELETE /notify/schedule/:jobId
 * Cancel a pending scheduled job.
 */
notifyRouter.delete('/schedule/:jobId', (req: Request, res: Response) => {
  const jobId = typeof req.params.jobId === 'string' ? req.params.jobId : undefined;
  if (!jobId) {
    handleError(res, new Error('Missing jobId parameter'));
    return;
  }

  try {
    const cancelled = cancelJob(jobId);
    if (!cancelled) {
      handleError(res, new Error(`Job "${jobId}" not found`));
      return;
    }
    ok(res, { cancelled: true, jobId });
  } catch (err) {
    handleError(res, err);
  }
});
