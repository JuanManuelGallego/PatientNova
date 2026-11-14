import { AppointmentStatus, BookingApprovalMode, BookingRequestStatus, type Channel } from '../../generated/prisma/enums.js';
import type { confirmationViewSelect } from '../booking-requests/booking-request.repository.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { providerDisplayName } from '../public-booking/public-booking.service.js';
import { ONE_MINUTE_MS } from '../utils/config/constants.js';
import { providerContactOf, type ProviderContact } from './patient-notices.js';

export interface BookingPendingDto {
  channel: 'EMAIL' | 'WHATSAPP';
  contact: string;
  startUtc: string;
  holdExpiresAt: string;
  approvalRequired: boolean;
  releaseToken: string;
}

export function toBookingPendingDto(
  request: { startAt: Date; holdExpiresAt: Date },
  contact: { channel: Channel; value: string },
  approvalRequired: boolean,
  releaseToken: string,
): BookingPendingDto {
  return {
    channel: contact.channel === 'EMAIL' ? 'EMAIL' : 'WHATSAPP',
    contact: contact.value,
    startUtc: request.startAt.toISOString(),
    holdExpiresAt: request.holdExpiresAt.toISOString(),
    approvalRequired,
    releaseToken,
  };
}

export type ConfirmationState = 'unconfirmed' | 'confirmed' | 'requested' | 'expired' | 'unavailable';

export interface BookingConfirmationView {
  state: ConfirmationState;
  providerSlug: string;
  providerName: string;
  startUtc: string;
  durationMinutes: number;
  patientTimezone: string;
  typeName: string;
  location: { name: string; address: string | null; isVirtual: boolean };
  holdExpiresAt: string;
  approvalRequired: boolean;
  providerContact: ProviderContact;
}

type ConfirmationRow = Prisma.BookingRequestGetPayload<{ select: typeof confirmationViewSelect }>;

export function confirmationState(
  row: Pick<ConfirmationRow, 'status' | 'confirmedAt' | 'resolvedBy' | 'holdExpiresAt'> & {
    appointment: Pick<NonNullable<ConfirmationRow['appointment']>, 'status' | 'isDeleted'> | null;
  },
  now: Date,
): ConfirmationState {
  switch (row.status) {
    case BookingRequestStatus.UNCONFIRMED:
      return row.holdExpiresAt > now ? 'unconfirmed' : 'expired';
    case BookingRequestStatus.APPROVED: {
      const appt = row.appointment;
      return appt && !appt.isDeleted && appt.status !== AppointmentStatus.CANCELLED ? 'confirmed' : 'unavailable';
    }
    case BookingRequestStatus.CANCELLED:
      return row.resolvedBy !== 'system' && row.confirmedAt === null ? 'expired' : 'unavailable';
    case BookingRequestStatus.EXPIRED:
      return row.confirmedAt === null ? 'expired' : 'unavailable';
    case BookingRequestStatus.PENDING:
      return row.holdExpiresAt > now ? 'requested' : 'unavailable';
    case BookingRequestStatus.REJECTED:
      return 'unavailable';
  }
}

function bookedSlot(row: ConfirmationRow, state: ConfirmationState) {
  const appt = state === 'confirmed' ? row.appointment : null;
  return {
    startAt: appt?.startAt ?? row.startAt,
    endAt: appt?.endAt ?? row.endAt,
    patientTimezone: appt?.patientTimezone ?? row.patientTimezone,
    typeName: appt?.appointmentType?.name ?? row.type.name,
    location: appt?.appointmentLocation ?? row.location,
  };
}

export function toBookingConfirmationView(row: ConfirmationRow, now: Date): BookingConfirmationView {
  const state = confirmationState(row, now);
  const { user } = row;
  const { startAt, endAt, patientTimezone, typeName, location } = bookedSlot(row, state);
  return {
    state,
    providerSlug: user.bookingSlug ?? '',
    providerName: providerDisplayName(user),
    startUtc: startAt.toISOString(),
    durationMinutes: Math.round((endAt.getTime() - startAt.getTime()) / ONE_MINUTE_MS),
    patientTimezone,
    typeName,
    location: { name: location.name, address: location.isVirtual ? null : location.address, isVirtual: location.isVirtual },
    holdExpiresAt: row.holdExpiresAt.toISOString(),
    approvalRequired: state === 'requested' || (state !== 'confirmed' && user.bookingApprovalMode === BookingApprovalMode.REQUIRE_APPROVAL),
    providerContact: providerContactOf(user),
  };
}
