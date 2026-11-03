import {
  ActionType,
  AppointmentStatus,
  CancelledBy,
  EntityType,
  ReminderStatus,
} from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import { config } from '../utils/config/config.js';
import { ONE_MINUTE_MS } from '../utils/config/constants.js';
import { logger } from '../utils/api/logger.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { runInAuditContext } from '../audit-log/audit-log-context.js';
import { portalPatientAuditContext } from '../audit-log/audit-actors.js';
import { cancelLinkedReminder, updateWithin } from '../appointments/appointment.service.js';
import type { UpdateAppointmentDto } from '../appointments/appointment.schemas.js';
import { computeSlots, isSlotFree } from '../public-booking/public-booking.service.js';
import type { SlotRangeQuery } from '../public-booking/public-booking.schemas.js';
import { reminderJobManager } from '../scheduler/reminder-job-manager.js';
import { hasCurrentConsent, type ConsentRequestMeta } from '../patient-consents/patient-consent.service.js';
import { resolvePortalPatient } from './patient-resolution.js';
import { PRIVACY_POLICY_VERSION } from './privacy-policy.js';
import { portalBookingRepository } from './portal-booking.repository.js';
import { canCancel, canReschedule, portalActionContext } from './portal-appointment-actions.js';
import {
  PortalAppointmentNotFoundError,
  PortalRescheduleUnavailableError,
  RescheduleSameTimeError,
  SlotUnavailableError,
} from './portal-booking.errors.js';
import { portalReminder, requireSelfBooking, toPortalError } from './portal-booking.service.js';
import { toPortalAppointmentDto, type PortalAppointmentDto } from './portal-appointment.dto.js';
import type { ReschedulePortalAppointmentBody } from './portal-booking.schemas.js';
import { deliverPortalNotificationsNow, enqueuePortalNotifications } from './portal-booking-notifications.js';
import type { PortalSessionContext } from './portal-session.middleware.js';

/**
 * The session's patient, only when it may see its appointments (a matched patient with a current consent).
 * Every other case is the same 404 as an appointment that is not theirs.
 */
async function requireConsentedPatient(session: PortalSessionContext, tx: TransactionClient): Promise<string> {
  const resolution = await resolvePortalPatient(session, tx);
  if (resolution.kind !== 'patient') throw new PortalAppointmentNotFoundError();
  if (!(await hasCurrentConsent(resolution.patientId, PRIVACY_POLICY_VERSION, tx))) throw new PortalAppointmentNotFoundError();
  return resolution.patientId;
}

/** Tidies the queue after commit; the worker already skips a reminder that is no longer PENDING. */
async function dropQueuedReminderJob(reminderId: string | null): Promise<void> {
  if (!reminderId || !config.scheduler.enabled) return;
  try {
    await reminderJobManager.cancel(reminderId);
  } catch (err) {
    logger.warn({ reminderId, err }, 'Could not remove the queued job of a cancelled reminder');
  }
}

/**
 * The linked reminder after a move: a PENDING one follows the new time with its channel and address unchanged
 * (the provider may have switched it), or is cancelled when the new time is under 24h away; otherwise a new
 * email reminder is linked when there is still time for it. A SENT reminder is never rewritten.
 */
async function reminderPatch(
  tx: TransactionClient,
  appointmentId: string,
  start: Date,
  now: Date,
  email: string,
): Promise<Pick<UpdateAppointmentDto, 'reminder'>> {
  const linked = await tx.reminder.findFirst({
    where: { appointmentId, isDeleted: false },
    select: { status: true, channel: true, to: true },
  });
  const pending = linked?.status === ReminderStatus.PENDING;
  const reminder = pending ? portalReminder(start, now, linked.to, linked.channel) : portalReminder(start, now, email);
  if (reminder) return { reminder };
  return pending ? { reminder: null } : {};
}

/**
 * Everything a reschedule needs before a slot is chosen, in order: booking live in auto-confirm (else the
 * unknown-provider 404), a consented patient, their own upcoming active appointment (else 404), booked online
 * with a still-bookable type and location (else 409). Shared by the slot list and the move itself.
 */
async function loadReschedulable(tx: TransactionClient, session: PortalSessionContext, appointmentId: string, now: Date) {
  const { userId } = session;
  const settings = await requireSelfBooking(userId, tx);

  const patientId = await requireConsentedPatient(session, tx);
  const appt = await portalBookingRepository.findOwn(userId, patientId, appointmentId, tx);
  if (!appt || !canCancel(appt, now)) throw new PortalAppointmentNotFoundError();
  // Same rule as the `canReschedule` flag the patient sees, so the button and the endpoint never disagree.
  if (!canReschedule(appt, portalActionContext(settings, true, now))) throw new PortalRescheduleUnavailableError();
  return { settings, appt, durationMinutes: appt.appointmentType!.defaultDuration };
}

export const portalAppointmentService = {
  /** Cancels any upcoming active appointment of the session's patient. No cutoff. */
  async cancel(session: PortalSessionContext, appointmentId: string, meta: ConsentRequestMeta): Promise<void> {
    const { userId } = session;
    const auditContext = portalPatientAuditContext({ userId, email: session.email, ipAddress: meta.ipAddress });

    const cancelledReminderId = await runInAuditContext(auditContext, () => prisma.$transaction(async (tx) => {
      await withProviderLock(tx, userId);
      const patientId = await requireConsentedPatient(session, tx);
      const appt = await portalBookingRepository.findOwn(userId, patientId, appointmentId, tx);
      const now = new Date();
      if (!appt || !canCancel(appt, now)) throw new PortalAppointmentNotFoundError();

      await tx.appointment.update({
        where: { id: appt.id, userId },
        data: { status: AppointmentStatus.CANCELLED, cancelledAt: now, cancelledBy: CancelledBy.PATIENT, paid: false },
      });
      await logAudit({
        entityType: EntityType.APPOINTMENT,
        entityId: appt.id,
        userId,
        actionType: ActionType.UPDATE,
        description: 'Cita cancelada por el paciente desde el portal',
        affectedFields: [ 'status', 'cancelledBy', 'paid' ],
        fieldsBefore: { status: appt.status },
        fieldsAfter: { status: AppointmentStatus.CANCELLED, cancelledBy: CancelledBy.PATIENT, paid: false },
        tx,
        required: true,
      });
      const reminderId = await cancelLinkedReminder(tx, appt.id, userId);
      await enqueuePortalNotifications('cancelled', appt.id, tx);
      return reminderId;
    }, { timeout: 10000 }));

    logger.info({ appointmentId, userId }, 'Appointment cancelled by the patient in the portal');
    await dropQueuedReminderJob(cancelledReminderId);
    await deliverPortalNotificationsNow('cancelled', appointmentId);
  },

  /**
   * Free start times for moving one of the patient's own online bookings: the type's current duration, the
   * appointment itself not counted as busy (so nearby times show), and its current start left out.
   */
  async rescheduleSlots(session: PortalSessionContext, appointmentId: string, range: SlotRangeQuery) {
    const { userId } = session;
    return prisma.$transaction(async (tx) => {
      const { settings, appt, durationMinutes } = await loadReschedulable(tx, session, appointmentId, new Date());
      const slots = await computeSlots(userId, settings, durationMinutes, range, { excludeAppointmentId: appt.id, tx });
      const current = appt.startAt.toISOString();
      return { timezone: settings.timezone, slots: slots.filter((s) => s.startUtc !== current) };
    });
  },

  /**
   * Moves one of the patient's own online bookings to a new slot, in place (same id), under the provider lock.
   * Same slot rules as booking; the type's current duration; price, status and confirmation unchanged.
   */
  async reschedule(
    session: PortalSessionContext,
    appointmentId: string,
    body: ReschedulePortalAppointmentBody,
    meta: ConsentRequestMeta,
  ): Promise<PortalAppointmentDto> {
    const { userId } = session;
    const auditContext = portalPatientAuditContext({ userId, email: session.email, ipAddress: meta.ipAddress });
    const start = new Date(body.startUtc);

    try {
      const { moved, move, settings } = await runInAuditContext(auditContext, () => prisma.$transaction(async (tx) => {
        await withProviderLock(tx, userId);
        const now = new Date();
        const { settings, appt, durationMinutes } = await loadReschedulable(tx, session, appointmentId, now);
        if (start.getTime() === appt.startAt.getTime()) throw new RescheduleSameTimeError();

        const end = new Date(start.getTime() + durationMinutes * ONE_MINUTE_MS);
        const free = await isSlotFree(userId, settings, durationMinutes, start, now, { excludeAppointmentId: appt.id, tx });
        if (!free) throw new SlotUnavailableError();

        await updateWithin(tx, appt.id, {
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          ...(await reminderPatch(tx, appt.id, start, now, session.email)),
        }, userId, { patientTimezone: body.patientTimezone, replaceSettledReminder: true });
        await tx.appointment.update({ where: { id: appt.id, userId }, data: { patientRescheduleCount: { increment: 1 } } });
        const move = { previousStartAt: appt.startAt, startAt: start };
        await enqueuePortalNotifications('rescheduled', appt.id, tx, move);
        return { moved: await portalBookingRepository.findForDto(appt.id, tx), move, settings };
      }, { timeout: 10000 }));

      logger.info({ appointmentId, userId }, 'Appointment rescheduled by the patient in the portal');
      await deliverPortalNotificationsNow('rescheduled', appointmentId, move);
      return toPortalAppointmentDto(moved, portalActionContext(settings, true, new Date()));
    } catch (err) {
      throw toPortalError(err);
    }
  },
};
