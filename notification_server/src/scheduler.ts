import { randomUUID } from 'crypto';
import { logger } from './utils/logger.js';
import { sendWhatsApp, sendSms } from './twillo/twilioClient.js';
import { Channel, type ScheduleRequest, type ScheduleResult } from './utils/types.js';

// ─── In-memory job store ──────────────────────────────────────────────────────
// Replace with BullMQ + Redis for production persistence and retries.

type JobStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

interface ScheduledJob {
  id: string;
  request: ScheduleRequest;
  sendAt: Date;
  scheduledAt: Date;
  status: JobStatus;
  timer: ReturnType<typeof setTimeout>;
  messageSid?: string;
  error?: string;
}

const jobs = new Map<string, ScheduledJob>();

// ─── Schedule ─────────────────────────────────────────────────────────────────

export function scheduleNotification(req: ScheduleRequest): ScheduleResult {
  const sendAt = new Date(req.sendAt);
  const now = new Date();

  if (isNaN(sendAt.getTime())) {
    throw new Error(`Invalid sendAt date: "${req.sendAt}"`);
  }
  if (sendAt <= now) {
    throw new Error(`sendAt must be in the future (received: ${req.sendAt})`);
  }

  const delayMs = sendAt.getTime() - now.getTime();
  const id = randomUUID();

  const timer = setTimeout(async () => {
    const job = jobs.get(id);
    if (!job || job.status === 'cancelled') return;

    logger.info({ jobId: id, channel: req.channel }, 'Executing scheduled notification');

    try {
      const result =
        req.channel === Channel.WHATSAPP
          ? await sendWhatsApp(req.payload as Parameters<typeof sendWhatsApp>[ 0 ])
          : await sendSms(req.payload as Parameters<typeof sendSms>[ 0 ]);

      job.status = 'sent';
      job.messageSid = result.messageSid || '';
      logger.info({ jobId: id, sid: result.messageSid }, 'Scheduled notification sent');
    } catch (err) {
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : String(err);
      logger.error({ jobId: id, error: job.error }, 'Scheduled notification failed');
    }
  }, delayMs);

  const to =
    'to' in req.payload ? req.payload.to : '(unknown)';

  const job: ScheduledJob = {
    id,
    request: req,
    sendAt,
    scheduledAt: now,
    status: 'pending',
    timer,
  };

  jobs.set(id, job);

  logger.info(
    { jobId: id, channel: req.channel, to, sendAt: sendAt.toISOString(), delayMs },
    'Notification scheduled'
  );

  return {
    jobId: id,
    channel: req.channel,
    to,
    sendAt: sendAt.toISOString(),
    scheduledAt: now.toISOString(),
  };
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export function cancelJob(jobId: string): boolean {
  const job = jobs.get(jobId);
  if (!job) return false;
  if (job.status !== 'pending') {
    throw new Error(`Job ${jobId} is "${job.status}" and cannot be cancelled`);
  }
  clearTimeout(job.timer);
  job.status = 'cancelled';
  logger.info({ jobId }, 'Scheduled notification cancelled');
  return true;
}

// ─── Inspect ──────────────────────────────────────────────────────────────────

export function getJob(jobId: string) {
  const job = jobs.get(jobId);
  if (!job) return null;
  return serializeJob(job);
}

export function listJobs(statusFilter?: JobStatus) {
  const all = [ ...jobs.values() ];
  const filtered = statusFilter ? all.filter(j => j.status === statusFilter) : all;
  return filtered.map(serializeJob);
}

function serializeJob(job: ScheduledJob) {
  return {
    id: job.id,
    channel: job.request.channel,
    to: 'to' in job.request.payload ? job.request.payload.to : null,
    sendAt: job.sendAt.toISOString(),
    scheduledAt: job.scheduledAt.toISOString(),
    status: job.status,
    messageSid: job.messageSid,
    error: job.error,
  };
}
