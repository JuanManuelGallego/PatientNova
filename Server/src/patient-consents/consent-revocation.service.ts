import { ActionSource, ActionType, BookingRequestStatus, EntityType, ReminderStatus } from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import { runInAuditContext } from '../audit-log/audit-log-context.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { bookingRequestRepository, HOLDING_STATUSES } from '../booking-requests/booking-request.repository.js';
import { patientConsentRepository } from './patient-consent.repository.js';

const PRIVACY_OPERATOR = {
  actorId: 'privacy-operator',
  actorDisplayName: 'Operador de privacidad',
  source: ActionSource.JOB,
};

const patientSelect = {
  userId: true,
  portalAccessEnabled: true,
  messagesStoppedAt: true,
  emailHash: true,
  whatsappHash: true,
  smsHash: true,
} as const;

async function loadPatient(patientId: string, tx: TransactionClient) {
  const patient = await tx.patient.findUnique({ where: { id: patientId }, select: patientSelect });
  if (!patient) throw new Error('Patient not found');
  await withProviderLock(tx, patient.userId);
  return patient;
}

type RevocationPatient = Awaited<ReturnType<typeof loadPatient>>;

async function revokeConsents(tx: TransactionClient, patientId: string, userId: string, revokedAt: Date): Promise<number> {
  const consents = await patientConsentRepository.findAllActive(patientId, tx);
  for (const consent of consents) {
    await patientConsentRepository.markRevoked(consent.id, revokedAt, tx);
    await logAudit({
      entityType: EntityType.PATIENT_CONSENT,
      entityId: consent.id,
      userId,
      actionType: ActionType.UPDATE,
      description: `Consentimiento de tratamiento de datos revocado (política ${consent.policyVersion})`,
      affectedFields: [ 'revokedAt' ],
      fieldsBefore: { revokedAt: null },
      fieldsAfter: { revokedAt },
      tx,
      required: true,
    });
  }
  return consents.length;
}

/** A pending request carries a consent given before this revocation, so it must not reach approval. */
async function cancelLiveRequests(tx: TransactionClient, patientId: string, patient: RevocationPatient, now: Date): Promise<number> {
  const phones = [ patient.whatsappHash, patient.smsHash ].filter((hash): hash is string => hash !== null);
  const requests = await tx.bookingRequest.findMany({
    where: {
      userId: patient.userId,
      status: { in: HOLDING_STATUSES },
      OR: [
        { patientId },
        ...(patient.emailHash ? [ { emailHash: patient.emailHash } ] : []),
        ...(phones.length > 0 ? [ { verifiedPhoneHash: { in: phones } } ] : []),
      ],
    },
    select: { id: true, status: true },
  });
  for (const { id, status } of requests) {
    await bookingRequestRepository.cancel(id, now, tx, 'system');
    await logAudit({
      entityType: EntityType.BOOKING_REQUEST,
      entityId: id,
      userId: patient.userId,
      actionType: ActionType.UPDATE,
      description: 'Solicitud de reserva cancelada por revocación del consentimiento',
      affectedFields: [ 'status' ],
      fieldsBefore: { status },
      fieldsAfter: { status: BookingRequestStatus.CANCELLED },
      tx,
      required: true,
    });
  }
  return requests.length;
}

async function setPortalAccess(tx: TransactionClient, patientId: string, userId: string, enabled: boolean): Promise<void> {
  await tx.patient.update({ where: { id: patientId }, data: { portalAccessEnabled: enabled } });
  await logAudit({
    entityType: EntityType.PATIENT,
    entityId: patientId,
    userId,
    actionType: ActionType.UPDATE,
    description: enabled
      ? 'Acceso al portal reactivado por el operador de privacidad'
      : 'Acceso al portal desactivado por revocación del consentimiento',
    affectedFields: [ 'portalAccessEnabled' ],
    fieldsBefore: { portalAccessEnabled: !enabled },
    fieldsAfter: { portalAccessEnabled: enabled },
    tx,
    required: true,
  });
}

async function setMessagesStopped(
  tx: TransactionClient,
  patientId: string,
  userId: string,
  before: Date | null,
  after: Date | null,
): Promise<void> {
  await tx.patient.update({ where: { id: patientId }, data: { messagesStoppedAt: after } });
  await logAudit({
    entityType: EntityType.PATIENT,
    entityId: patientId,
    userId,
    actionType: ActionType.UPDATE,
    description: after
      ? 'Mensajes automáticos detenidos por revocación del consentimiento'
      : 'Mensajes automáticos reactivados por el operador de privacidad',
    affectedFields: [ 'messagesStoppedAt' ],
    fieldsBefore: { messagesStoppedAt: before },
    fieldsAfter: { messagesStoppedAt: after },
    tx,
    required: true,
  });
}

async function cancelPendingReminders(tx: TransactionClient, patientId: string, userId: string): Promise<number> {
  const reminders = await tx.reminder.findMany({
    where: { patientId, userId, status: ReminderStatus.PENDING, isDeleted: false },
    select: { id: true },
  });
  for (const { id } of reminders) {
    await tx.reminder.update({ where: { id }, data: { status: ReminderStatus.CANCELLED } });
    await logAudit({
      entityType: EntityType.REMINDER,
      entityId: id,
      userId,
      actionType: ActionType.UPDATE,
      description: 'Recordatorio cancelado por revocación del consentimiento',
      affectedFields: [ 'status' ],
      fieldsBefore: { status: ReminderStatus.PENDING },
      fieldsAfter: { status: ReminderStatus.CANCELLED },
      tx,
      required: true,
    });
  }
  return reminders.length;
}

export interface RevocationResult {
  revoked: number;
  requestsCancelled: number;
  portalBlocked: boolean;
  messagesStopped: boolean;
  remindersCancelled: number;
}

/**
 * Operator action behind the revocation procedure in `docs/compliance-patient-data.md`, section 4.
 * Revocation never cancels care: appointments stay with the clinic. Running it twice changes nothing.
 */
export async function revokePatientConsents(
  patientId: string,
  options: { blockPortal?: boolean; stopMessages?: boolean } = {},
): Promise<RevocationResult> {
  return runInAuditContext(PRIVACY_OPERATOR, () => prisma.$transaction(async (tx) => {
    const patient = await loadPatient(patientId, tx);
    const now = new Date();
    const revoked = await revokeConsents(tx, patientId, patient.userId, now);
    const requestsCancelled = await cancelLiveRequests(tx, patientId, patient, now);

    const portalBlocked = options.blockPortal === true && patient.portalAccessEnabled;
    if (portalBlocked) await setPortalAccess(tx, patientId, patient.userId, false);

    const messagesStopped = options.stopMessages === true && patient.messagesStoppedAt === null;
    if (messagesStopped) await setMessagesStopped(tx, patientId, patient.userId, null, now);
    const remindersCancelled = options.stopMessages ? await cancelPendingReminders(tx, patientId, patient.userId) : 0;

    return { revoked, requestsCancelled, portalBlocked, messagesStopped, remindersCancelled };
  }));
}

/** Reopens what a revocation closed. Consent is never restored here: the patient authorizes again. */
export async function restorePatientAccess(
  patientId: string,
  options: { portal?: boolean; messages?: boolean },
): Promise<{ portalRestored: boolean; messagesRestored: boolean }> {
  return runInAuditContext(PRIVACY_OPERATOR, () => prisma.$transaction(async (tx) => {
    const patient = await loadPatient(patientId, tx);
    const portalRestored = options.portal === true && !patient.portalAccessEnabled;
    if (portalRestored) await setPortalAccess(tx, patientId, patient.userId, true);
    const messagesRestored = options.messages === true && patient.messagesStoppedAt !== null;
    if (messagesRestored) await setMessagesStopped(tx, patientId, patient.userId, patient.messagesStoppedAt, null);
    return { portalRestored, messagesRestored };
  }));
}
