import { ActionSource, ActionType, EntityType } from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import { runInAuditContext } from '../audit-log/audit-log-context.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { portalActorId } from '../audit-log/audit-actors.js';

export const ERASED_TEXT = '[Contenido suprimido]';

const PRIVACY_OPERATOR = {
  actorId: 'privacy-operator',
  actorDisplayName: 'Operador de privacidad',
  source: ActionSource.JOB,
};
const ERASED_ACTOR = 'suprimido';
const AUDIT_BATCH = 500;

export interface ErasureResult {
  erased: boolean;
  appointments: number;
  reminders: number;
  consents: number;
  bookingRequests: number;
  medicalRecord: boolean;
  auditRows: number;
}

const patientSelect = {
  userId: true,
  name: true,
  lastName: true,
  email: true,
  whatsappNumber: true,
  smsNumber: true,
  emailHash: true,
  whatsappHash: true,
  smsHash: true,
} as const;

type ErasurePatient = NonNullable<Awaited<ReturnType<typeof loadPatient>>>;

function loadPatient(tx: TransactionClient, patientId: string) {
  return tx.patient.findUnique({ where: { id: patientId }, select: patientSelect });
}

function requestWhere(patientId: string, patient: ErasurePatient) {
  const phones = [ patient.whatsappHash, patient.smsHash ].filter((hash): hash is string => hash !== null);
  return {
    userId: patient.userId,
    OR: [
      { patientId },
      ...(patient.emailHash ? [ { emailHash: patient.emailHash } ] : []),
      ...(phones.length > 0 ? [ { verifiedPhoneHash: { in: phones } } ] : []),
    ],
  };
}

function patientMentions(patient: ErasurePatient): string[] {
  return [ `${patient.name} ${patient.lastName}`, patient.email, patient.whatsappNumber, patient.smsNumber ]
    .filter((value): value is string => !!value)
    .map((value) => value.toLowerCase());
}

/**
 * Rows to redact: every row about the patient's own records, their portal activity, and any other row of this
 * provider that mentions their full name or a contact. Mentions are found on decrypted text, so this reads the
 * provider's whole log; an erasure is rare and manual.
 */
async function findAuditRows(tx: TransactionClient, patientId: string, patient: ErasurePatient, entityIds: Set<string>): Promise<string[]> {
  const mentions = patientMentions(patient);
  const actors = new Set(
    [ patient.email, patient.whatsappNumber, patient.smsNumber ]
      .filter((contact): contact is string => !!contact)
      .map((contact) => portalActorId(patient.userId, contact)),
  );
  const matches: string[] = [];
  let cursor: string | undefined;
  for (;;) {
    const rows = await tx.auditLog.findMany({
      where: { userId: patient.userId },
      orderBy: { id: 'asc' },
      take: AUDIT_BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, entityId: true, actorId: true, portalPatientId: true, description: true, fieldsBefore: true, fieldsAfter: true },
    });
    for (const row of rows) {
      const text = JSON.stringify([ row.description, row.fieldsBefore, row.fieldsAfter ]).toLowerCase();
      if (
        entityIds.has(row.entityId)
        || row.portalPatientId === patientId
        || actors.has(row.actorId)
        || mentions.some((mention) => text.includes(mention))
      ) matches.push(row.id);
    }
    if (rows.length < AUDIT_BATCH) return matches;
    cursor = rows[ rows.length - 1 ]!.id;
  }
}

/**
 * The one exception to the audit log's immutability (`auditLogGuardExtension`): raw SQL, constants only, and only
 * on a confirmed erasure. Who acted, what kind of change and when all stay.
 */
async function redactAuditRows(tx: TransactionClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await tx.$executeRaw`
    UPDATE "AuditLog"
    SET "description" = ${ERASED_TEXT}, "fieldsBefore" = NULL, "fieldsAfter" = NULL, "ipAddress" = NULL
    WHERE "id" = ANY(${ids}::text[])`;
  await tx.$executeRaw`
    UPDATE "AuditLog"
    SET "actorId" = ${ERASED_ACTOR}, "actorDisplayName" = ${ERASED_TEXT}, "portalPatientId" = NULL
    WHERE "id" = ANY(${ids}::text[]) AND "source" = 'PUBLIC_PORTAL'`;
}

/**
 * Erases a patient for good, after the clinic approves it (`docs/compliance-patient-data.md`, section 6).
 * Without `confirm` it only reports what would go. Clinical records usually must be kept, so this is rare.
 * Backups keep the data until they expire: rerun it after any restore.
 */
export async function erasePatient(patientId: string, options: { confirm?: boolean } = {}): Promise<ErasureResult> {
  return runInAuditContext(PRIVACY_OPERATOR, () => prisma.$transaction(async (tx) => {
    const patient = await loadPatient(tx, patientId);
    if (!patient) throw new Error('Patient not found');
    await withProviderLock(tx, patient.userId);

    const [ appointments, reminders, consents, requests, record ] = await Promise.all([
      tx.appointment.findMany({ where: { patientId }, select: { id: true } }),
      tx.reminder.findMany({ where: { patientId }, select: { id: true } }),
      tx.patientConsent.findMany({ where: { patientId }, select: { id: true } }),
      tx.bookingRequest.findMany({ where: requestWhere(patientId, patient), select: { id: true } }),
      tx.medicalRecord.findUnique({ where: { patientId }, select: { id: true } }),
    ]);
    const entityIds = new Set([
      patientId,
      ...[ ...appointments, ...reminders, ...consents, ...requests ].map(({ id }) => id),
      ...(record ? [ record.id ] : []),
    ]);
    const auditIds = await findAuditRows(tx, patientId, patient, entityIds);
    const result: ErasureResult = {
      erased: false,
      appointments: appointments.length,
      reminders: reminders.length,
      consents: consents.length,
      bookingRequests: requests.length,
      medicalRecord: record !== null,
      auditRows: auditIds.length,
    };
    if (!options.confirm) return result;

    await tx.bookingRequest.deleteMany({ where: { id: { in: requests.map(({ id }) => id) } } });
    await tx.patientConsent.deleteMany({ where: { patientId } });
    await tx.reminder.deleteMany({ where: { patientId } });
    await tx.appointment.deleteMany({ where: { patientId } });
    await tx.patient.delete({ where: { id: patientId } });
    await redactAuditRows(tx, auditIds);
    await logAudit({
      entityType: EntityType.PATIENT,
      entityId: patientId,
      userId: patient.userId,
      actionType: ActionType.DELETE,
      description: 'Paciente suprimido por solicitud de datos personales',
      affectedFields: [],
      tx,
      required: true,
    });
    return { ...result, erased: true };
  }, { timeout: 120_000 }));
}
