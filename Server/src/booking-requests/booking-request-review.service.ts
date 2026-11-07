import {
  ActionType,
  AppointmentStatus,
  BookingRequestStatus,
  EntityType,
  PatientStatus,
  RecordSource,
} from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import { logger } from '../utils/api/logger.js';
import { buildPaginatedResult, type Paginated } from '../utils/api/pagination.js';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { getAuditContext } from '../audit-log/audit-log-context.js';
import { createPatientWithin, restorePatientWithin, updatePatientWithin } from '../patients/patient.service.js';
import { PatientEmailConflictError } from '../patients/patient.errors.js';
import { ensureCurrentConsent } from '../patient-consents/patient-consent.service.js';
import { patientConsentRepository } from '../patient-consents/patient-consent.repository.js';
import { createPortalAppointmentWithin } from '../portal/portal-booking.service.js';
import { deliverPortalNotificationsNow, enqueuePortalNotifications, type PortalEvent } from '../portal/portal-booking-notifications.js';
import { bookingRequestRepository } from './booking-request.repository.js';
import {
  deliverBookingRequestNotificationsNow,
  enqueueBookingRequestNotifications,
} from './booking-request-notifications.js';
import { isTrustedPhoneMatch } from '../portal/patient-resolution.js';
import { newPatientContact, requestContact, typedPhoneIsUnverified } from '../portal/portal-contact.js';
import {
  BookingRequestCandidateError,
  BookingRequestNotFoundError,
  BookingRequestConsentRevokedError,
  BookingRequestNotPendingError,
  BookingRequestRestoreCandidateError,
} from './booking-request.errors.js';
import {
  toProviderRequestDetailDto,
  toProviderRequestDto,
  type ProviderRequestDetailDto,
  type ProviderRequestDto,
  type RequestCandidate,
} from './booking-request.dto.js';
import type { ApproveBookingRequestBody, ListBookingRequestsQuery } from './booking-request.schemas.js';

const LAST_VISIT_STATUSES = [ AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED ];

type RequestContact = { emailHash: string | null; verifiedPhoneHash: string | null };

/** Every patient of this provider sharing the request's verified contact, computed at view or approval time. */
async function findCandidates(userId: string, contact: RequestContact, now: Date, tx?: TransactionClient): Promise<RequestCandidate[]> {
  const phone = contact.verifiedPhoneHash;
  if (!phone && !contact.emailHash) return [];
  const rows = await (tx ?? prisma).patient.findMany({
    where: { userId, ...(phone ? { OR: [ { whatsappHash: phone }, { smsHash: phone } ] } : { emailHash: contact.emailHash }) },
    select: {
      id: true,
      name: true,
      lastName: true,
      email: true,
      whatsappNumber: true,
      smsNumber: true,
      whatsappHash: true,
      smsHash: true,
      whatsappUnverified: true,
      status: true,
      portalAccessEnabled: true,
      isDeleted: true,
      deletedAt: true,
      createdAt: true,
      appointments: {
        where: { isDeleted: false, startAt: { lt: now }, status: { in: LAST_VISIT_STATUSES } },
        orderBy: { startAt: 'desc' },
        take: 1,
        select: { startAt: true },
      },
    },
    orderBy: [ { isDeleted: 'asc' }, { deletedAt: 'desc' }, { createdAt: 'desc' } ],
  });
  return rows.map(({ appointments, deletedAt, createdAt, whatsappHash, smsHash, ...p }) => ({
    ...p,
    unverifiedMatch: !!phone && !isTrustedPhoneMatch({ whatsappHash, smsHash, whatsappUnverified: p.whatsappUnverified }, phone),
    deletedAt: deletedAt?.toISOString() ?? null,
    createdAt: createdAt.toISOString(),
    lastVisitAt: appointments[ 0 ]?.startAt.toISOString() ?? null,
  }));
}

function actorId(fallback: string): string {
  return getAuditContext()?.actorId ?? fallback;
}

async function requirePending(userId: string, id: string, now: Date, tx: TransactionClient) {
  const request = await bookingRequestRepository.findForProvider(userId, id, tx);
  if (!request) throw new BookingRequestNotFoundError();
  if (request.status !== BookingRequestStatus.PENDING || request.holdExpiresAt <= now) throw new BookingRequestNotPendingError();
  return request;
}

type PendingRequest = Awaited<ReturnType<typeof requirePending>>;

async function logRequestResolution(
  tx: TransactionClient,
  request: PendingRequest,
  userId: string,
  status: BookingRequestStatus,
  extra: { appointmentId?: string; patientId?: string } = {},
) {
  await logAudit({
    entityType: EntityType.BOOKING_REQUEST,
    entityId: request.id,
    userId,
    actionType: ActionType.UPDATE,
    description: status === BookingRequestStatus.APPROVED ? 'Solicitud de reserva aprobada' : 'Solicitud de reserva rechazada',
    affectedFields: [ 'status', ...Object.keys(extra) ],
    fieldsBefore: { status: BookingRequestStatus.PENDING },
    fieldsAfter: { status, ...extra },
    tx,
    required: true,
  });
}

/** An existing record the provider chose to use is made usable through the patient service, each step audited. */
async function restorePatient(tx: TransactionClient, userId: string, patientId: string) {
  const restored = await restorePatientWithin(tx, patientId, userId, {
    description: 'Paciente restaurado al aprobar una solicitud de reserva',
  });
  return restored.status;
}

async function reactivatePatient(tx: TransactionClient, userId: string, patientId: string) {
  await updatePatientWithin(tx, patientId, { status: PatientStatus.ACTIVE }, userId, {
    description: 'Paciente reactivado al aprobar una solicitud de reserva',
  });
}

async function endorseProvenNumber(tx: TransactionClient, userId: string, chosen: RequestCandidate, proven: boolean) {
  if (!proven || !chosen.unverifiedMatch) return;
  await updatePatientWithin(tx, chosen.id, {}, userId, {
    description: 'Número de WhatsApp verificado al aprobar una solicitud de reserva',
    endorseWhatsapp: true,
  });
}

/**
 * The patient the appointment is for: the record the provider chose (restored or reactivated as needed), else the contact's
 * single active match, else a new PORTAL patient from the request. For a number that match has to be trusted, like at
 * login: a shared or unverified number never picks a record on its own.
 */
async function resolveApprovalPatient(
  tx: TransactionClient,
  userId: string,
  request: PendingRequest,
  body: ApproveBookingRequestBody,
  now: Date,
): Promise<string> {
  const candidates = await findCandidates(userId, request, now, tx);
  const active = candidates.filter((c) => !c.isDeleted);
  const proven = !!request.verifiedPhone;

  if (body?.existingPatientId) {
    const chosen = active.find((c) => c.id === body.existingPatientId);
    if (!chosen) throw new BookingRequestCandidateError();
    if (chosen.status !== PatientStatus.ACTIVE) await reactivatePatient(tx, userId, chosen.id);
    await endorseProvenNumber(tx, userId, chosen, proven);
    return chosen.id;
  }

  if (body?.restorePatientId) {
    const chosen = candidates.find((c) => c.isDeleted && c.id === body.restorePatientId);
    if (!chosen) throw new BookingRequestRestoreCandidateError();
    if (!proven && active.length > 0) throw new PatientEmailConflictError();
    const status = await restorePatient(tx, userId, chosen.id);
    if (status !== PatientStatus.ACTIVE) await reactivatePatient(tx, userId, chosen.id);
    await endorseProvenNumber(tx, userId, chosen, proven);
    return chosen.id;
  }

  const trusted = active.filter((c) => !c.unverifiedMatch);
  const match = proven ? (trusted.length === 1 ? trusted[ 0 ] : undefined) : active[ 0 ];
  if (match) {
    if (match.status !== PatientStatus.ACTIVE) await reactivatePatient(tx, userId, match.id);
    return match.id;
  }

  const contact = requestContact(request);
  if (!contact) throw new Error('Booking request has no contact');
  const patient = await createPatientWithin(tx, {
    name: request.name,
    lastName: request.lastName,
    ...newPatientContact(contact, request.phone),
    status: PatientStatus.ACTIVE,
  }, userId, { source: RecordSource.PORTAL, whatsappUnverified: typedPhoneIsUnverified(contact, request.phone) });
  return patient.id;
}

export const bookingRequestReviewService = {
  async list(userId: string, query: ListBookingRequestsQuery): Promise<Paginated<ProviderRequestDto>> {
    const now = new Date();
    const { rows, total } = await bookingRequestRepository.listForProvider(userId, query, now);
    return buildPaginatedResult(rows.map((r) => toProviderRequestDto(r, now)), total, query.page, query.pageSize);
  },

  async count(userId: string): Promise<{ pending: number }> {
    return { pending: await bookingRequestRepository.countPending(userId, new Date()) };
  },

  async detail(userId: string, id: string): Promise<ProviderRequestDetailDto> {
    const now = new Date();
    const request = await bookingRequestRepository.findForProvider(userId, id);
    if (!request) throw new BookingRequestNotFoundError();
    const candidates = await findCandidates(userId, request, now);
    return toProviderRequestDetailDto(request, candidates, now);
  },

  /**
   * One transaction: lock → still PENDING and live → patient → consent with the request's evidence → appointment
   * (its own hold excluded) → APPROVED → required audits → patient confirmation. A conflict rolls everything back
   * and leaves the request PENDING.
   */
  async approve(userId: string, id: string, body: ApproveBookingRequestBody): Promise<ProviderRequestDetailDto> {
    const outcome = await prisma.$transaction(async (tx) => {
      await withProviderLock(tx, userId);
      const now = new Date();
      const request = await requirePending(userId, id, now, tx);
      const patientId = await resolveApprovalPatient(tx, userId, request, body, now);

      if (await patientConsentRepository.findRevokedSince(patientId, request.consentAcceptedAt, tx)) {
        throw new BookingRequestConsentRevokedError();
      }
      await ensureCurrentConsent(
        tx,
        { patientId, userId },
        request.policyVersion,
        { ipAddress: request.consentIp ?? undefined, userAgent: request.consentUserAgent ?? undefined },
        request.consentAcceptedAt,
      );

      const type = await tx.appointmentType.findFirst({ where: { id: request.type.id, userId }, select: { defaultPrice: true } });
      const { appointment, linkPending } = await createPortalAppointmentWithin(tx, {
        userId,
        patientId,
        typeId: request.type.id,
        locationId: request.location.id,
        isVirtual: request.location.isVirtual,
        price: type?.defaultPrice ?? 0,
        start: request.startAt,
        end: request.endAt,
        patientTimezone: request.patientTimezone,
        excludeRequestId: request.id,
      }, now);

      await bookingRequestRepository.resolve(request.id, {
        status: BookingRequestStatus.APPROVED,
        resolvedAt: now,
        resolvedBy: actorId(userId),
        appointmentId: appointment.id,
        patientId,
      }, tx);
      await logRequestResolution(tx, request, userId, BookingRequestStatus.APPROVED, { appointmentId: appointment.id, patientId });

      // A pending Meet link confirms the patient later, through `meeting-ready`.
      const event: PortalEvent | null = linkPending ? null : 'approved';
      if (event) await enqueuePortalNotifications(event, appointment.id, tx);
      return { appointmentId: appointment.id, event };
    }, { timeout: 10000 });

    if (outcome.event) await deliverPortalNotificationsNow(outcome.event, outcome.appointmentId);
    logger.info({ requestId: id, userId, appointmentId: outcome.appointmentId }, 'Booking request approved');
    return bookingRequestReviewService.detail(userId, id);
  },

  async reject(userId: string, id: string): Promise<ProviderRequestDetailDto> {
    await prisma.$transaction(async (tx) => {
      await withProviderLock(tx, userId);
      const now = new Date();
      const request = await requirePending(userId, id, now, tx);
      await bookingRequestRepository.resolve(request.id, {
        status: BookingRequestStatus.REJECTED,
        resolvedAt: now,
        resolvedBy: actorId(userId),
      }, tx);
      await logRequestResolution(tx, request, userId, BookingRequestStatus.REJECTED);
      await enqueueBookingRequestNotifications('rejected', [ request.id ], tx);
    }, { timeout: 10000 });

    await deliverBookingRequestNotificationsNow('rejected', [ id ]);
    logger.info({ requestId: id, userId }, 'Booking request rejected');
    return bookingRequestReviewService.detail(userId, id);
  },
};
