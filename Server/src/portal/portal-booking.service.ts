import {
  AppointmentStatus,
  BookingApprovalMode,
  MeetingStatus,
  PatientStatus,
  type PortalReminderTiming,
  RecordSource,
  ReminderMode,
  ReminderStatus,
} from '../../generated/prisma/enums.js';
import { type TransactionClient } from '../utils/prisma/prisma-client.js';
import { isAppointmentOverlapViolation } from '../utils/errors/prisma-errors.js';
import { bindAuditPortalPatient } from '../audit-log/audit-log-context.js';
import { bookingSettingsRepository } from '../booking-settings/booking-settings.repository.js';
import { bookingSettingsService } from '../booking-settings/booking-settings.service.js';
import { publicBookingRepository } from '../public-booking/public-booking.repository.js';
import {
  ProviderNotFoundError,
  PublicAppointmentTypeNotFoundError,
  PublicLocationNotFoundError,
} from '../public-booking/public-booking.errors.js';
import { createWithin } from '../appointments/appointment.service.js';
import { AppointmentBlockedTimeConflictError, AppointmentConflictError, AppointmentHoldConflictError } from '../appointments/appointment.errors.js';
import { createPatientWithin } from '../patients/patient.service.js';
import { PatientEmailConflictError, PatientLimitReachedError } from '../patients/patient.errors.js';
import { ensureCurrentConsent, type ConsentRequestMeta } from '../patient-consents/patient-consent.service.js';
import { patientConsentRepository } from '../patient-consents/patient-consent.repository.js';
import { resolvePortalPatient, type PortalIdentity } from './patient-resolution.js';
import { isConsentRequired } from './portal-session.service.js';
import { portalBookingRepository } from './portal-booking.repository.js';
import { loadPatientRoute, type PatientRoute } from './patient-route.js';
import { portalReminderSendAt } from './portal-reminder-timing.js';
import { toPortalAppointmentDto, type PortalAppointmentDto } from './portal-appointment.dto.js';
import { portalActionContext } from './portal-appointment-actions.js';
import { portalRequestService } from './portal-request.service.js';
import type { PortalRequestDto } from './portal-request.dto.js';
import { PortalBookingLimitError, PortalBookingUnavailableError, PortalPatientDetailsRequiredError, SlotUnavailableError } from './portal-booking.errors.js';
import { newPatientContact, typedPhoneIsUnverified } from './portal-contact.js';
import { enqueuePortalNotifications, type PortalEvent } from './portal-booking-notifications.js';
import { enqueueProvisionMeet, meetingPendingMode } from './portal-meeting.service.js';
import type { PortalSessionContext } from './portal-session.middleware.js';

export const MAX_UPCOMING_PORTAL_BOOKINGS = 3;

/**
 * The gate for a patient choosing a slot (booking or reschedule): booking live and in auto-confirm mode,
 * else the unknown-provider 404. Returns the settings the slot check needs.
 */
export async function requireSelfBooking(userId: string, tx: TransactionClient) {
  const { settings, approval } = await resolveBookingMode(userId, tx);
  if (approval) throw new ProviderNotFoundError();
  return settings;
}

export async function resolveBookingMode(userId: string, tx: TransactionClient) {
  if (!(await bookingSettingsService.isBookingLive(userId, tx))) throw new ProviderNotFoundError();
  const settings = await bookingSettingsRepository.getSettings(userId, tx);
  return { settings, approval: settings.bookingApprovalMode === BookingApprovalMode.REQUIRE_APPROVAL };
}

export function portalReminder(start: Date, now: Date, route: PatientRoute | null, timing: PortalReminderTiming, timezone: string) {
  if (!route) return undefined;
  const sendAt = portalReminderSendAt(start, timing, timezone);
  if (!sendAt || sendAt <= now || sendAt >= start) return undefined;
  return { ...route, sendMode: ReminderMode.SCHEDULED, sendAt: sendAt.toISOString(), status: ReminderStatus.PENDING };
}

export async function requireBookableTarget(userId: string, ids: { typeId: string; locationId: string }, tx: TransactionClient) {
  const type = await publicBookingRepository.findBookableType(userId, ids.typeId, tx);
  if (!type) throw new PublicAppointmentTypeNotFoundError();
  const location = await publicBookingRepository.findBookableLocation(userId, ids.locationId, tx);
  if (!location) throw new PublicLocationNotFoundError();
  return { type, location };
}

export function toPortalError(err: unknown): unknown {
  if (
    err instanceof AppointmentConflictError
    || err instanceof AppointmentBlockedTimeConflictError
    || err instanceof AppointmentHoldConflictError
    || isAppointmentOverlapViolation(err)
  ) return new SlotUnavailableError();
  if (err instanceof PatientLimitReachedError || err instanceof PatientEmailConflictError) return new PortalBookingUnavailableError();
  return err;
}

export interface PortalAppointmentInput {
  userId: string;
  patientId: string;
  typeId: string;
  locationId: string;
  isVirtual: boolean;
  price: number;
  start: Date;
  end: Date;
  patientTimezone: string;
  reminderTiming: PortalReminderTiming;
  /** Approval: the request whose own hold must not block its appointment. */
  excludeRequestId?: string;
}

/**
 * Creates a CONFIRMED portal appointment on `tx` (the caller holds the provider lock): a reminder on the patient's
 * route, meeting provisioning for a virtual location, and the job that will confirm it. Shared by `book` and approval.
 */
export async function createPortalAppointmentWithin(tx: TransactionClient, input: PortalAppointmentInput, now: Date) {
  const reminder = portalReminder(
    input.start,
    now,
    await loadPatientRoute(input.userId, input.patientId, tx),
    input.reminderTiming,
    input.patientTimezone,
  );
  const meetingPending = input.isVirtual ? await meetingPendingMode(input.userId, tx) : undefined;
  const appointment = await createWithin(tx, {
    startAt: input.start.toISOString(),
    endAt: input.end.toISOString(),
    price: input.price,
    paid: false,
    status: AppointmentStatus.CONFIRMED,
    patientId: input.patientId,
    locationId: input.locationId,
    typeId: input.typeId,
    ...(reminder && { reminder }),
  }, input.userId, {
    source: RecordSource.PORTAL,
    patientTimezone: input.patientTimezone,
    ...(meetingPending && { meetingPending }),
    ...(input.excludeRequestId && { excludeRequestId: input.excludeRequestId }),
  });
  const linkPending = appointment.meetingStatus === MeetingStatus.PENDING;
  if (linkPending) await enqueueProvisionMeet(appointment.id, tx);
  return { appointment, linkPending };
}

export interface TypedPatient {
  name: string;
  lastName: string;
  phone?: string | null | undefined;
}

export interface IdentityBookingInput {
  patient: TypedPatient | undefined;
  type: { id: string; defaultPrice: number | null };
  location: { id: string; isVirtual: boolean };
  start: Date;
  end: Date;
  patientTimezone: string;
  reminderTiming: PortalReminderTiming;
  consent: { policyVersion: string; acceptedAt: Date; meta: ConsentRequestMeta };
  excludeRequestId?: string;
}

export type IdentityBookingResult =
  | { kind: 'appointment'; appointmentId: string; patientId: string; event: PortalEvent }
  | { kind: 'review' };

async function createPortalPatient(tx: TransactionClient, identity: PortalIdentity, typed: TypedPatient | undefined) {
  if (!typed) throw new PortalPatientDetailsRequiredError();
  const patient = await createPatientWithin(tx, {
    name: typed.name,
    lastName: typed.lastName,
    ...newPatientContact(identity.contact, typed.phone),
    status: PatientStatus.ACTIVE,
  }, identity.userId, { source: RecordSource.PORTAL, whatsappUnverified: typedPhoneIsUnverified(identity.contact, typed.phone) });
  bindAuditPortalPatient(patient.id);
  return patient.id;
}

export async function bookForIdentityWithin(
  tx: TransactionClient,
  identity: PortalIdentity,
  input: IdentityBookingInput,
  now: Date,
): Promise<IdentityBookingResult> {
  const { userId } = identity;
  const resolution = await resolvePortalPatient(identity, tx);
  if (resolution.kind === 'unavailable') {
    if (!resolution.review) throw new PortalBookingUnavailableError();
    // An inactive or deleted-only record: the provider decides through a REVIEW request (6.6).
    return { kind: 'review' };
  }
  const patientId = resolution.kind === 'patient' ? resolution.patientId : await createPortalPatient(tx, identity, input.patient);
  if (await portalBookingRepository.countUpcomingPortal(userId, patientId, now, tx) >= MAX_UPCOMING_PORTAL_BOOKINGS) {
    throw new PortalBookingLimitError();
  }
  if (await patientConsentRepository.findRevokedSince(patientId, input.consent.acceptedAt, tx)) throw new PortalBookingUnavailableError();
  await ensureCurrentConsent(tx, { patientId, userId }, input.consent.policyVersion, input.consent.meta, input.consent.acceptedAt);

  const { appointment, linkPending } = await createPortalAppointmentWithin(tx, {
    userId,
    patientId,
    typeId: input.type.id,
    locationId: input.location.id,
    isVirtual: input.location.isVirtual,
    price: input.type.defaultPrice ?? 0,
    start: input.start,
    end: input.end,
    patientTimezone: input.patientTimezone,
    reminderTiming: input.reminderTiming,
    ...(input.excludeRequestId && { excludeRequestId: input.excludeRequestId }),
  }, now);
  const event: PortalEvent = linkPending ? 'booked-link-pending' : 'booked';
  await enqueuePortalNotifications(event, appointment.id, tx);
  return { kind: 'appointment', appointmentId: appointment.id, patientId, event };
}

export const portalBookingService = {
  async listAppointments(
    session: PortalSessionContext,
  ): Promise<{ appointments: PortalAppointmentDto[]; requests: PortalRequestDto[]; consentRequired: boolean }> {
    const [ requests, { resolution, consentRequired } ] = await Promise.all([
      portalRequestService.list(session),
      resolvePortalPatient(session).then(async (resolution) => ({ resolution, consentRequired: await isConsentRequired(resolution) })),
    ]);
    if (resolution.kind !== 'patient' || consentRequired) return { appointments: [], requests, consentRequired: true };
    const now = new Date();
    const [ rows, settings, live ] = await Promise.all([
      portalBookingRepository.listUpcoming(session.userId, resolution.patientId, now),
      bookingSettingsRepository.getSettings(session.userId),
      bookingSettingsService.isBookingLive(session.userId),
    ]);
    const ctx = portalActionContext(settings, live, now);
    return { appointments: rows.map((row) => toPortalAppointmentDto(row, ctx)), requests, consentRequired };
  },
};
