import { fromPrisma } from 'pg-boss';
import { ActionType, EntityType, MeetingStatus, type AppointmentStatus } from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import { config } from '../utils/config/config.js';
import { ONE_MINUTE_MS } from '../utils/config/constants.js';
import { logger } from '../utils/api/logger.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { getBoss } from '../scheduler/pg-boss.js';
import { ACTIVE_STATUSES } from '../appointments/appointment-status.js';
import { updateWithin } from '../appointments/appointment.service.js';
import type { MeetingPending } from '../appointments/appointment-meeting.service.js';
import { googleMeetService } from '../google/google-meet.service.js';
import { GoogleOAuthError } from '../google/google-errors.js';
import { googleConnectionRepository, isConnectionUsable } from '../google/google-connection.repository.js';
import { deliverPortalNotificationsNow, enqueuePortalNotifications } from './portal-booking-notifications.js';

export const PROVISION_MEET_QUEUE = 'provision-meet';
/** A `PENDING` link older than this is handed to the provider (`NEEDS_LINK`) by the sweep. */
export const PENDING_MEETING_TIMEOUT_MS = 30 * ONE_MINUTE_MS;

/** Job payload: the appointment id only. */
export interface ProvisionMeetJob {
  appointmentId: string;
}

/** Google cannot create a link for this provider (no connection, no scope, revoked, not configured): no retry helps. */
const NO_RETRY_CODES = new Set([ 'GOOGLE_CONNECTION_NOT_FOUND', 'GOOGLE_SCOPE_MISSING', 'GOOGLE_TOKEN_REVOKED', 'GOOGLE_CONFIG_MISSING' ]);

const isWaitingForMeet = (a: { meetingStatus: MeetingStatus; status: AppointmentStatus; isDeleted: boolean } | null) =>
  !!a && a.meetingStatus === MeetingStatus.PENDING && ACTIVE_STATUSES.has(a.status) && !a.isDeleted;

const waitingSelect = { userId: true, meetingStatus: true, status: true, isDeleted: true } as const;

/**
 * How a portal booking at a virtual location gets its link: `auto` (the `provision-meet` job creates a Meet) when the
 * scheduler runs and the provider's Google connection is usable, otherwise `manual` (the provider adds any link).
 */
export async function meetingPendingMode(userId: string, tx: TransactionClient): Promise<MeetingPending> {
  if (!config.scheduler.enabled) return 'manual';
  return isConnectionUsable(await googleConnectionRepository.findByUserId(userId, tx)) ? 'auto' : 'manual';
}

/** Enqueued on the booking `tx`, so a rollback drops it. One job per appointment. */
export async function enqueueProvisionMeet(appointmentId: string, tx: TransactionClient): Promise<void> {
  const job: ProvisionMeetJob = { appointmentId };
  await getBoss().send(PROVISION_MEET_QUEUE, job, { db: fromPrisma(tx), singletonKey: appointmentId });
}

/**
 * The provider must add the link: a `PENDING` appointment becomes `NEEDS_LINK` and the held confirmation goes out
 * (saying the link will follow). No-op unless it is still `PENDING`, active and not deleted.
 */
export async function markNeedsLink(appointmentId: string, reason: string): Promise<boolean> {
  const changed = await prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.findUnique({ where: { id: appointmentId }, select: waitingSelect });
    if (!appt) return false;
    await withProviderLock(tx, appt.userId);
    const fresh = await tx.appointment.findUnique({ where: { id: appointmentId }, select: waitingSelect });
    if (!isWaitingForMeet(fresh)) return false;

    await tx.appointment.update({ where: { id: appointmentId }, data: { meetingStatus: MeetingStatus.NEEDS_LINK } });
    await logAudit({
      entityType: EntityType.APPOINTMENT,
      entityId: appointmentId,
      userId: appt.userId,
      actionType: ActionType.UPDATE,
      description: 'Enlace de videollamada pendiente: el profesional debe agregarlo',
      affectedFields: [ 'meetingStatus' ],
      fieldsBefore: { meetingStatus: MeetingStatus.PENDING },
      fieldsAfter: { meetingStatus: MeetingStatus.NEEDS_LINK },
      tx,
      required: true,
    });
    await enqueuePortalNotifications('meeting-ready', appointmentId, tx);
    return true;
  }, { timeout: 10000 });

  if (changed) {
    logger.info({ appointmentId, reason }, 'Portal meeting link handed to the provider');
    await deliverPortalNotificationsNow('meeting-ready', appointmentId);
  }
  return changed;
}

export type ProvisionOutcome = 'ready' | 'needs-link' | 'skipped';

/**
 * Creates the Meet link of a `PENDING` portal appointment. Google is called outside any transaction; the link is
 * then set through `updateWithin` under the provider lock (re-rendered reminder, audit, held confirmation). A
 * provider-side failure falls back to `NEEDS_LINK` at once; a Google API error is rethrown for a retry, and falls back
 * on the final attempt. A space created for an appointment cancelled meanwhile is left unused.
 */
export async function provisionMeet(appointmentId: string, finalAttempt: boolean): Promise<ProvisionOutcome> {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: waitingSelect });
  if (!appt || !isWaitingForMeet(appt)) return 'skipped';

  let meetingUrl: string;
  try {
    ({ meetingUrl } = await googleMeetService.createMeetingSpace(appt.userId));
  } catch (err) {
    const code = err instanceof GoogleOAuthError ? err.code : 'UNKNOWN';
    if (NO_RETRY_CODES.has(code) || finalAttempt) {
      await markNeedsLink(appointmentId, code);
      return 'needs-link';
    }
    throw err;
  }

  const set = await prisma.$transaction(async (tx) => {
    await withProviderLock(tx, appt.userId);
    const fresh = await tx.appointment.findUnique({ where: { id: appointmentId }, select: waitingSelect });
    if (!isWaitingForMeet(fresh)) return false;
    await updateWithin(tx, appointmentId, { meetingUrl }, appt.userId);
    return true;
  }, { timeout: 10000 });

  if (!set) {
    logger.info({ appointmentId }, 'Meet link not used: the appointment changed while it was being created');
    return 'skipped';
  }
  logger.info({ appointmentId }, 'Portal meeting link created');
  return 'ready';
}

/** Backstop for jobs that never ran: `PENDING` for longer than the timeout is handed to the provider. */
export async function sweepPendingMeetings(now = new Date()): Promise<number> {
  const stale = await prisma.appointment.findMany({
    where: {
      meetingStatus: MeetingStatus.PENDING,
      isDeleted: false,
      status: { in: [ ...ACTIVE_STATUSES ] },
      createdAt: { lt: new Date(now.getTime() - PENDING_MEETING_TIMEOUT_MS) },
    },
    select: { id: true },
    take: 200,
  });
  let moved = 0;
  for (const { id } of stale) {
    try {
      if (await markNeedsLink(id, 'sweep')) moved += 1;
    } catch (err) {
      logger.error({ appointmentId: id, err }, 'Could not hand a pending meeting link to the provider');
    }
  }
  return moved;
}

/** Upcoming active appointments whose video-call link the provider still has to add (admin banner). */
export async function findNeedsMeetingLink(userId: string, now = new Date()) {
  const where = {
    userId,
    meetingStatus: MeetingStatus.NEEDS_LINK,
    isDeleted: false,
    status: { in: [ ...ACTIVE_STATUSES ] },
    startAt: { gt: now },
  };
  const [ count, appointments ] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({ where, select: { id: true, startAt: true }, orderBy: { startAt: 'asc' }, take: 50 }),
  ]);
  return { count, appointments };
}
