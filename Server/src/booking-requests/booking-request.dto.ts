import { BookingRequestStatus, type BookingRequestKind, type PatientStatus } from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { providerRequestDetailSelect, providerRequestSelect } from './booking-request.repository.js';

type ProviderRequestRow = Prisma.BookingRequestGetPayload<{ select: typeof providerRequestSelect }>;
type ProviderRequestDetailRow = Prisma.BookingRequestGetPayload<{ select: typeof providerRequestDetailSelect }>;

/** Provider inbox row. `status` is effective: a PENDING row past `holdExpiresAt` reads EXPIRED. */
export interface ProviderRequestDto {
  id: string;
  kind: BookingRequestKind;
  status: BookingRequestStatus;
  createdAt: string;
  startAt: string;
  endAt: string;
  holdExpiresAt: string;
  resolvedAt: string | null;
  name: string;
  lastName: string;
  email: string;
  phone: string | null;
  patientTimezone: string;
  appointmentId: string | null;
  patientId: string | null;
  type: { id: string; name: string };
  location: { id: string; name: string; isVirtual: boolean };
}

/** A patient sharing the request's email, computed at view time. */
export interface RequestCandidate {
  id: string;
  name: string;
  lastName: string;
  email: string | null;
  whatsappNumber: string | null;
  status: PatientStatus;
  portalAccessEnabled: boolean;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  lastVisitAt: string | null;
}

export interface ProviderRequestDetailDto extends ProviderRequestDto {
  consent: { policyVersion: string; acceptedAt: string };
  /** The active record first (at most one), then deleted ones, newest deletion first. */
  candidates: RequestCandidate[];
}

export function effectiveStatus(status: BookingRequestStatus, holdExpiresAt: Date, now: Date): BookingRequestStatus {
  return status === BookingRequestStatus.PENDING && holdExpiresAt <= now ? BookingRequestStatus.EXPIRED : status;
}

export function toProviderRequestDto(r: ProviderRequestRow, now: Date): ProviderRequestDto {
  return {
    id: r.id,
    kind: r.kind,
    status: effectiveStatus(r.status, r.holdExpiresAt, now),
    createdAt: r.createdAt.toISOString(),
    startAt: r.startAt.toISOString(),
    endAt: r.endAt.toISOString(),
    holdExpiresAt: r.holdExpiresAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    name: r.name,
    lastName: r.lastName,
    email: r.email,
    phone: r.phone,
    patientTimezone: r.patientTimezone,
    appointmentId: r.appointmentId,
    patientId: r.patientId,
    type: { id: r.type.id, name: r.type.name },
    location: { id: r.location.id, name: r.location.name, isVirtual: r.location.isVirtual },
  };
}

export function toProviderRequestDetailDto(
  r: ProviderRequestDetailRow,
  candidates: RequestCandidate[],
  now: Date,
): ProviderRequestDetailDto {
  return {
    ...toProviderRequestDto(r, now),
    consent: { policyVersion: r.policyVersion, acceptedAt: r.consentAcceptedAt.toISOString() },
    candidates,
  };
}
