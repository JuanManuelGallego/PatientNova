import { AppointmentStatus, CancelledBy } from '../../generated/prisma/enums.js';
import { ActionType, EntityType } from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import { config } from '../utils/config/config.js';
import { logger } from '../utils/api/logger.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { runInAuditContext } from '../audit-log/audit-log-context.js';
import { portalPatientAuditContext } from '../audit-log/audit-actors.js';
import { cancelLinkedReminder } from '../appointments/appointment.service.js';
import { reminderJobManager } from '../scheduler/reminder-job-manager.js';
import { hasCurrentConsent, type ConsentRequestMeta } from '../patient-consents/patient-consent.service.js';
import { resolvePortalPatient } from './patient-resolution.js';
import { PRIVACY_POLICY_VERSION } from './privacy-policy.js';
import { portalBookingRepository } from './portal-booking.repository.js';
import { canCancel } from './portal-appointment-actions.js';
import { PortalAppointmentNotFoundError } from './portal-booking.errors.js';
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
};
