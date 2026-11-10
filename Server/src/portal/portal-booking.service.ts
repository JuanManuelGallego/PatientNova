import {
  AppointmentStatus,
  BookingApprovalMode,
  BookingRequestKind,
  MeetingStatus,
  PatientStatus,
  type PortalReminderTiming,
  RecordSource,
  ReminderMode,
  ReminderStatus,
} from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import { isAppointmentOverlapViolation } from '../utils/errors/prisma-errors.js';
import { ONE_MINUTE_MS } from '../utils/config/constants.js';
import { bindAuditPortalPatient, runInAuditContext } from '../audit-log/audit-log-context.js';
import { portalPatientAuditContext } from '../audit-log/audit-actors.js';
import { bookingSettingsRepository } from '../booking-settings/booking-settings.repository.js';
import { bookingSettingsService } from '../booking-settings/booking-settings.service.js';
import { publicBookingRepository } from '../public-booking/public-booking.repository.js';
import { isSlotFree } from '../public-booking/public-booking.service.js';
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
import { resolvePortalPatient } from './patient-resolution.js';
import { PRIVACY_POLICY_VERSION } from './privacy-policy.js';
import { isConsentRequired } from './portal-session.service.js';
import { portalBookingRepository } from './portal-booking.repository.js';
import { loadPatientRoute, type PatientRoute } from './patient-route.js';
import { portalReminderSendAt } from './portal-reminder-timing.js';
import { toPortalAppointmentDto, type PortalAppointmentDto } from './portal-appointment.dto.js';
import { portalActionContext } from './portal-appointment-actions.js';
import { afterRequestCreated, holdSlotWithin, portalRequestService } from './portal-request.service.js';
import type { PortalRequestDto } from './portal-request.dto.js';
import { PortalBookingLimitError, PortalBookingUnavailableError, PortalPatientDetailsRequiredError, PortalPhoneFieldError, SlotUnavailableError } from './portal-booking.errors.js';
import { isPhoneContact, newPatientContact, typedPhoneIsUnverified } from './portal-contact.js';
import { deliverPortalNotificationsNow, enqueuePortalNotifications, type PortalEvent } from './portal-booking-notifications.js';
import { enqueueProvisionMeet, meetingPendingMode } from './portal-meeting.service.js';
import type { CreatePortalBookingBody } from './portal-booking.schemas.js';
import type { PortalSessionContext } from './portal-session.middleware.js';

export const MAX_UPCOMING_PORTAL_BOOKINGS = 3;

export type PortalBookingResult = { appointment: PortalAppointmentDto } | { request: PortalRequestDto };

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

/**
 * The reminder of a portal appointment at the provider's chosen preset, in the patient's zone; none when the
 * provider chose `NONE`, no route exists, or the send time is already past or not before the start.
 */
export function portalReminder(start: Date, now: Date, route: PatientRoute | null, timing: PortalReminderTiming, timezone: string) {
  if (!route) return undefined;
  const sendAt = portalReminderSendAt(start, timing, timezone);
  if (!sendAt || sendAt <= now || sendAt >= start) return undefined;
  return { ...route, sendMode: ReminderMode.SCHEDULED, sendAt: sendAt.toISOString(), status: ReminderStatus.PENDING };
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
    await bookingSettingsRepository.getPortalReminderTiming(input.userId, tx),
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

async function createPortalPatient(tx: TransactionClient, session: PortalSessionContext, typed: CreatePortalBookingBody['patient']) {
  if (!typed) throw new PortalPatientDetailsRequiredError();
  const patient = await createPatientWithin(tx, {
    name: typed.name,
    lastName: typed.lastName,
    ...newPatientContact(session.contact, typed.phone),
    status: PatientStatus.ACTIVE,
  }, session.userId, { source: RecordSource.PORTAL, whatsappUnverified: typedPhoneIsUnverified(session.contact, typed.phone) });
  bindAuditPortalPatient(patient.id);
  return patient.id;
}

export const portalBookingService = {
  async book(session: PortalSessionContext, body: CreatePortalBookingBody, meta: ConsentRequestMeta): Promise<PortalBookingResult> {
    const { userId } = session;
    if (isPhoneContact(session.contact) && body.patient?.phone) throw new PortalPhoneFieldError();
    const auditContext = portalPatientAuditContext({ userId, contact: session.contact, ipAddress: meta.ipAddress });
    const start = new Date(body.startUtc);

    try {
      const outcome = await runInAuditContext(auditContext, () => prisma.$transaction(async (tx) => {
        await withProviderLock(tx, userId);
        const { settings, approval } = await resolveBookingMode(userId, tx);

        const type = await publicBookingRepository.findBookableType(userId, body.typeId, tx);
        if (!type) throw new PublicAppointmentTypeNotFoundError();
        const location = await publicBookingRepository.findBookableLocation(userId, body.locationId, tx);
        if (!location) throw new PublicLocationNotFoundError();

        // Checked once for both paths: live holds count as busy, so a request never overlaps another hold either.
        const now = new Date();
        if (!(await isSlotFree(userId, settings, type.defaultDuration, start, now, { tx }))) throw new SlotUnavailableError();
        const slot = { typeId: type.id, locationId: location.id, durationMinutes: type.defaultDuration, start };

        if (approval) {
          return { kind: 'request' as const, held: await holdSlotWithin(tx, session, body, meta, slot, now) };
        }

        const end = new Date(start.getTime() + type.defaultDuration * ONE_MINUTE_MS);
        const resolution = await resolvePortalPatient(session, tx);
        if (resolution.kind === 'unavailable') {
          if (!resolution.review) throw new PortalBookingUnavailableError();
          // An inactive or deleted-only record: the provider decides through a REVIEW request (6.6).
          const held = await holdSlotWithin(tx, session, body, meta, slot, now, BookingRequestKind.REVIEW);
          return { kind: 'request' as const, held };
        }
        const patientId = resolution.kind === 'patient' ? resolution.patientId : await createPortalPatient(tx, session, body.patient);
        if (await portalBookingRepository.countUpcomingPortal(userId, patientId, now, tx) >= MAX_UPCOMING_PORTAL_BOOKINGS) {
          throw new PortalBookingLimitError();
        }
        await ensureCurrentConsent(tx, { patientId, userId }, PRIVACY_POLICY_VERSION, meta);

        const { appointment, linkPending } = await createPortalAppointmentWithin(tx, {
          userId,
          patientId,
          typeId: type.id,
          locationId: location.id,
          isVirtual: location.isVirtual,
          price: type.defaultPrice ?? 0,
          start,
          end,
          patientTimezone: body.patientTimezone,
        }, now);
        const event: PortalEvent = linkPending ? 'booked-link-pending' : 'booked';
        await enqueuePortalNotifications(event, appointment.id, tx);
        return { kind: 'appointment' as const, created: await portalBookingRepository.findForDto(appointment.id, tx), settings, event };
      }, { timeout: 10000 }));
      if (outcome.kind === 'request') {
        await afterRequestCreated(outcome.held);
        return { request: outcome.held.request };
      }
      const { created, settings, event } = outcome;
      await deliverPortalNotificationsNow(event, created.id);
      return { appointment: toPortalAppointmentDto(created, portalActionContext(settings, true, new Date())) };
    } catch (err) {
      throw toPortalError(err);
    }
  },

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
