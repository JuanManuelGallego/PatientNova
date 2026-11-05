import { BookingRequestStatus, type BookingRequestKind, type Channel, type PatientStatus } from '../../generated/prisma/enums.js';
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
  /** How the patient proved who they are: `email`, or `verifiedPhone` on this channel. */
  contactChannel: Channel;
  email: string | null;
  verifiedPhone: string | null;
  /** Typed in the booking form, never proven. */
  phone: string | null;
  patientTimezone: string;
  appointmentId: string | null;
  patientId: string | null;
  type: { id: string; name: string };
  location: { id: string; name: string; isVirtual: boolean };
}

/** A patient sharing the request's verified contact, computed at view time. */
export interface RequestCandidate {
  id: string;
  name: string;
  lastName: string;
  email: string | null;
  whatsappNumber: string | null;
  smsNumber: string | null;
  whatsappUnverified: boolean;
  /** The match is only a number typed in the booking form, so it proves nothing about this record. */
  unverifiedMatch: boolean;
  status: PatientStatus;
  portalAccessEnabled: boolean;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  lastVisitAt: string | null;
}

export interface ProviderRequestDetailDto extends ProviderRequestDto {
  consent: { policyVersion: string; acceptedAt: string };
  /** Active records first (at most one for an email, several for a shared number), then deleted ones, newest deletion first. */
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
    contactChannel: r.contactChannel,
    email: r.email,
    verifiedPhone: r.verifiedPhone,
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
