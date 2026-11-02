import {
  ActionType,
  AppointmentStatus,
  BookingApprovalMode,
  CancelledBy,
  Channel,
  EntityType,
  RecordSource,
  ReminderMode,
  ReminderStatus,
} from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import { config } from '../utils/config/config.js';
import { ONE_DAY_MS, ONE_MINUTE_MS } from '../utils/config/constants.js';
import { logger } from '../utils/api/logger.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { runInAuditContext } from '../audit-log/audit-log-context.js';
import { portalPatientAuditContext } from '../audit-log/audit-actors.js';
import { cancelLinkedReminder, updateWithin } from '../appointments/appointment.service.js';
import type { UpdateAppointmentDto } from '../appointments/appointment.schemas.js';
import { bookingSettingsRepository } from '../booking-settings/booking-settings.repository.js';
import { bookingSettingsService } from '../booking-settings/booking-settings.service.js';
import { publicBookingRepository } from '../public-booking/public-booking.repository.js';
import { ProviderNotFoundError } from '../public-booking/public-booking.errors.js';
import { isSlotAvailable } from '../public-booking/slot-engine.js';
import { reminderJobManager } from '../scheduler/reminder-job-manager.js';
import { hasCurrentConsent, type ConsentRequestMeta } from '../patient-consents/patient-consent.service.js';
import { resolvePortalPatient } from './patient-resolution.js';
import { PRIVACY_POLICY_VERSION } from './privacy-policy.js';
import { portalBookingRepository } from './portal-booking.repository.js';
import { canCancel } from './portal-appointment-actions.js';
import {
  PortalAppointmentNotFoundError,
  PortalRescheduleUnavailableError,
  RescheduleSameTimeError,
  SlotUnavailableError,
} from './portal-booking.errors.js';
import { toPortalError } from './portal-booking.service.js';
import { toPortalAppointmentDto, type PortalAppointmentDto } from './portal-appointment.dto.js';
import type { ReschedulePortalAppointmentBody } from './portal-booking.schemas.js';
import { deliverPortalNotificationsNow, enqueuePortalNotifications } from './portal-booking-notifications.js';
import type { PortalSessionContext } from './portal-session.middleware.js';

/**
 * The session's patient, only when it may see its appointments (a matched patient with a current consent).
 * Every other case is the same 404 as an appointment that is not theirs.
 */
export async function requireConsentedPatient(session: PortalSessionContext, tx: TransactionClient): Promise<string> {
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
 * The linked reminder after a move: a PENDING one follows the new time (or is cancelled when the new time is
 * under 24h away); otherwise a new one is linked when there is still time for it. A SENT reminder is never rewritten.
 */
async function reminderPatch(
  tx: TransactionClient,
  appointmentId: string,
  start: Date,
  now: Date,
  email: string,
): Promise<Pick<UpdateAppointmentDto, 'reminder'>> {
  const reminderAt = new Date(start.getTime() - ONE_DAY_MS);
  const linked = await tx.reminder.findFirst({ where: { appointmentId, isDeleted: false }, select: { status: true } });
  const fresh = {
    channel: Channel.EMAIL,
    to: email,
    sendMode: ReminderMode.SCHEDULED,
    sendAt: reminderAt.toISOString(),
    status: ReminderStatus.PENDING,
  };
  if (linked?.status === ReminderStatus.PENDING) return reminderAt > now ? { reminder: fresh } : { reminder: null };
  return reminderAt > now ? { reminder: fresh } : {};
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
      const { moved, previousStartAt } = await runInAuditContext(auditContext, () => prisma.$transaction(async (tx) => {
        await withProviderLock(tx, userId);
        if (!(await bookingSettingsService.isBookingLive(userId, tx))) throw new ProviderNotFoundError();
        const settings = await bookingSettingsRepository.getSettings(userId, tx);
        if (settings.bookingApprovalMode !== BookingApprovalMode.AUTO_CONFIRM) throw new ProviderNotFoundError();

        const patientId = await requireConsentedPatient(session, tx);
        const appt = await portalBookingRepository.findOwn(userId, patientId, appointmentId, tx);
        const now = new Date();
        if (!appt || !canCancel(appt, now)) throw new PortalAppointmentNotFoundError();
        if (appt.source !== RecordSource.PORTAL || !appt.typeId || !appt.locationId) throw new PortalRescheduleUnavailableError();

        const type = await publicBookingRepository.findBookableType(userId, appt.typeId, tx);
        const location = await publicBookingRepository.findBookableLocation(userId, appt.locationId, tx);
        if (!type || !location) throw new PortalRescheduleUnavailableError();
        if (start.getTime() === appt.startAt.getTime()) throw new RescheduleSameTimeError();

        const end = new Date(start.getTime() + type.defaultDuration * ONE_MINUTE_MS);
        const rules = await bookingSettingsRepository.listRules(userId, tx);
        const busy = await publicBookingRepository.loadBusy(userId, start, end, settings.bufferMinutes, tx, { excludeAppointmentId: appt.id });
        const available = isSlotAvailable(start, {
          timezone: settings.timezone,
          rules,
          durationMinutes: type.defaultDuration,
          slotIntervalMinutes: settings.slotIntervalMinutes,
          bufferMinutes: settings.bufferMinutes,
          minLeadMinutes: settings.minLeadMinutes,
          maxHorizonDays: settings.maxHorizonDays,
          now,
          busy: { ...busy, holds: [] },
        });
        if (!available) throw new SlotUnavailableError();

        await updateWithin(tx, appt.id, {
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          ...(await reminderPatch(tx, appt.id, start, now, session.email)),
        }, userId, { patientTimezone: body.patientTimezone, replaceSettledReminder: true });
        await enqueuePortalNotifications('rescheduled', appt.id, tx, appt.startAt);
        return { moved: await portalBookingRepository.findForDto(appt.id, tx), previousStartAt: appt.startAt };
      }, { timeout: 10000 }));

      logger.info({ appointmentId, userId }, 'Appointment rescheduled by the patient in the portal');
      await deliverPortalNotificationsNow('rescheduled', appointmentId, previousStartAt);
      return toPortalAppointmentDto(moved, { now: new Date(), canBook: true });
    } catch (err) {
      throw toPortalError(err);
    }
  },
};
