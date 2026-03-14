import { Router, type Request, type Response } from 'express';
import { sendWhatsApp, sendSms, getMessageStatus } from './twilioClient.js';

import {
  sendWhatsAppSchema,
  sendSmsSchema,
  scheduleSchema,
  validate,
} from './validation.js';
import { logger } from './logger.js';
import type { ApiResponse } from './types.js';
import { listJobs, getJob, cancelJob, scheduleNotification } from './scheduler.js';

export const router = Router();

function ok<T>(res: Response, data: T, status = 200) {
  const body: ApiResponse<T> = { success: true, data, timestamp: new Date().toISOString() };
  res.status(status).json(body);
}

function fail(res: Response, error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : String(error);
  logger.error({ error: message }, 'Request error');
  const body: ApiResponse = { success: false, error: message, timestamp: new Date().toISOString() };
  res.status(status).json(body);
}

/**
 * GET /health
 * Simple liveness check — returns uptime and service name.
 */
router.get('/health', (_req: Request, res: Response) => {
  ok(res, { service: 'notification-service-server', uptime: process.uptime() });
});


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
router.post(
  '/notify/whatsapp',
  validate(sendWhatsAppSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await sendWhatsApp(req.body);
      ok(res, result, 201);
    } catch (err) {
      fail(res, err);
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
router.post(
  '/notify/sms',
  validate(sendSmsSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await sendSms(req.body);
      ok(res, result, 201);
    } catch (err) {
      fail(res, err);
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
router.post(
  '/notify/schedule',
  validate(scheduleSchema),
  (req: Request, res: Response) => {
    try {
      const result = scheduleNotification(req.body);
      ok(res, result, 201);
    } catch (err) {
      fail(res, err, 400);
    }
  }
);

/**
 * GET /notify/schedule
 * List all scheduled jobs, optionally filtered by status.
 *
 * Query params: ?status=pending|sent|failed|cancelled
 */
router.get('/notify/schedule', (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const allowed = [ 'pending', 'sent', 'failed', 'cancelled' ];
  if (status && !allowed.includes(status)) {
    fail(res, `Invalid status filter. Allowed: ${allowed.join(', ')}`, 400);
    return;
  }
  const jobs = listJobs(status as Parameters<typeof listJobs>[ 0 ]);
  ok(res, { count: jobs.length, jobs });
});

/**
 * GET /notify/schedule/:jobId
 * Get details for a specific scheduled job.
 */
router.get('/notify/schedule/:jobId', (req: Request, res: Response) => {
  const jobId = typeof req.params.jobId === 'string' ? req.params.jobId : undefined;
  if (!jobId) {
    fail(res, 'Missing jobId parameter', 400);
    return;
  }

  const job = getJob(jobId);
  if (!job) {
    fail(res, `Job "${jobId}" not found`, 404);
    return;
  }
  ok(res, job);
});

/**
 * DELETE /notify/schedule/:jobId
 * Cancel a pending scheduled job.
 */
router.delete('/notify/schedule/:jobId', (req: Request, res: Response) => {
  const jobId = typeof req.params.jobId === 'string' ? req.params.jobId : undefined;
  if (!jobId) {
    fail(res, 'Missing jobId parameter', 400);
    return;
  }

  try {
    const cancelled = cancelJob(jobId);
    if (!cancelled) {
      fail(res, `Job "${jobId}" not found`, 404);
      return;
    }
    ok(res, { cancelled: true, jobId });
  } catch (err) {
    fail(res, err, 400);
  }
});

/**
 * GET /messages/:messageSid
 * Fetch live delivery status from Twilio for a sent message.
 */
router.get('/messages/:messageSid', async (req: Request, res: Response) => {
  const messageSid = typeof req.params.messageSid === 'string' ? req.params.messageSid : undefined;
  if (!messageSid) {
    fail(res, 'Missing messageSid parameter', 400);
    return;
  }

  try {
    const status = await getMessageStatus(messageSid);
    ok(res, status);
  } catch (err) {
    fail(res, err, 404);
  }
});

