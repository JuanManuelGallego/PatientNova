import {
  AppointmentStatus,
  BookingApprovalMode,
  Channel,
  MeetingStatus,
  PatientStatus,
  RecordSource,
  ReminderMode,
  ReminderStatus,
} from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import { isAppointmentOverlapViolation } from '../utils/errors/prisma-errors.js';
import { ONE_DAY_MS, ONE_MINUTE_MS } from '../utils/config/constants.js';
import { runInAuditContext } from '../audit-log/audit-log-context.js';
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
import { toPortalAppointmentDto, type PortalAppointmentDto } from './portal-appointment.dto.js';
import { portalActionContext } from './portal-appointment-actions.js';
import { holdSlotWithin, portalRequestService, sendRequestReceivedEmail } from './portal-request.service.js';
import type { PortalRequestDto } from './portal-request.dto.js';
import { PortalBookingLimitError, PortalBookingUnavailableError, SlotUnavailableError } from './portal-booking.errors.js';
import { deliverPortalNotificationsNow, enqueuePortalNotifications, type PortalEvent } from './portal-booking-notifications.js';
import { enqueueProvisionMeet, meetingPendingMode } from './portal-meeting.service.js';
import type { CreatePortalBookingBody } from './portal-booking.schemas.js';
import type { PortalSessionContext } from './portal-session.middleware.js';

export const MAX_UPCOMING_PORTAL_BOOKINGS = 3;

/** An auto-confirmed booking (201) or, in approval mode, a request the provider will review (202). */
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

/**
 * Booking must be live (else the unknown-provider 404). `approval` says the provider reviews each booking:
 * a patient then creates a request instead of an appointment, and cannot reschedule.
 */
export async function resolveBookingMode(userId: string, tx: TransactionClient) {
  if (!(await bookingSettingsService.isBookingLive(userId, tx))) throw new ProviderNotFoundError();
  const settings = await bookingSettingsRepository.getSettings(userId, tx);
  return { settings, approval: settings.bookingApprovalMode === BookingApprovalMode.REQUIRE_APPROVAL };
}

/** The email reminder of a portal appointment: 24h before it, or none when that time has already passed. */
export function portalReminder(start: Date, now: Date, to: string, channel: Channel = Channel.EMAIL) {
  const sendAt = new Date(start.getTime() - ONE_DAY_MS);
  if (sendAt <= now) return undefined;
  return { channel, to, sendMode: ReminderMode.SCHEDULED, sendAt: sendAt.toISOString(), status: ReminderStatus.PENDING };
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

async function resolveOrCreatePatient(
  tx: TransactionClient,
  session: PortalSessionContext,
  typed: CreatePortalBookingBody['patient'],
): Promise<string> {
  const resolution = await resolvePortalPatient(session, tx);
  if (resolution.kind === 'patient') return resolution.patientId;
  if (resolution.kind === 'unavailable') throw new PortalBookingUnavailableError();
  const patient = await createPatientWithin(tx, {
    name: typed.name,
    lastName: typed.lastName,
    whatsappNumber: typed.phone || null,
    email: session.email,
    reminderChannel: Channel.EMAIL,
    status: PatientStatus.ACTIVE,
  }, session.userId, { source: RecordSource.PORTAL });
  return patient.id;
}

export const portalBookingService = {
  async book(session: PortalSessionContext, body: CreatePortalBookingBody, meta: ConsentRequestMeta): Promise<PortalBookingResult> {
    const { userId } = session;
    const auditContext = portalPatientAuditContext({ userId, email: session.email, ipAddress: meta.ipAddress });
    const start = new Date(body.startUtc);

    try {
      const outcome = await runInAuditContext(auditContext, () => prisma.$transaction(async (tx) => {
        await withProviderLock(tx, userId);
        const { settings, approval } = await resolveBookingMode(userId, tx);

        const type = await publicBookingRepository.findBookableType(userId, body.typeId, tx);
        if (!type) throw new PublicAppointmentTypeNotFoundError();
        const location = await publicBookingRepository.findBookableLocation(userId, body.locationId, tx);
        if (!location) throw new PublicLocationNotFoundError();

        if (approval) {
          const request = await holdSlotWithin(tx, session, body, meta, {
            settings, typeId: type.id, locationId: location.id, durationMinutes: type.defaultDuration, start,
          });
          return { kind: 'request' as const, request };
        }

        const now = new Date();
        const end = new Date(start.getTime() + type.defaultDuration * ONE_MINUTE_MS);
        if (!(await isSlotFree(userId, settings, type.defaultDuration, start, now, { tx }))) throw new SlotUnavailableError();

        const patientId = await resolveOrCreatePatient(tx, session, body.patient);
        if (await portalBookingRepository.countUpcomingPortal(userId, patientId, now, tx) >= MAX_UPCOMING_PORTAL_BOOKINGS) {
          throw new PortalBookingLimitError();
        }
        await ensureCurrentConsent(tx, { patientId, userId }, PRIVACY_POLICY_VERSION, meta);

        const reminder = portalReminder(start, now, session.email);
        const meetingPending = location.isVirtual ? await meetingPendingMode(userId, tx) : undefined;
        const appointment = await createWithin(tx, {
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          price: type.defaultPrice ?? 0,
          paid: false,
          status: AppointmentStatus.CONFIRMED,
          patientId,
          locationId: location.id,
          typeId: type.id,
          ...(reminder && { reminder }),
        }, userId, {
          source: RecordSource.PORTAL,
          patientTimezone: body.patientTimezone,
          ...(meetingPending && { meetingPending }),
        });
        const linkPending = appointment.meetingStatus === MeetingStatus.PENDING;
        if (linkPending) await enqueueProvisionMeet(appointment.id, tx);
        const event: PortalEvent = linkPending ? 'booked-link-pending' : 'booked';
        await enqueuePortalNotifications(event, appointment.id, tx);
        return { kind: 'appointment' as const, created: await portalBookingRepository.findForDto(appointment.id, tx), settings, event };
      }, { timeout: 10000 }));
      if (outcome.kind === 'request') {
        await sendRequestReceivedEmail(userId, session.email);
        return { request: outcome.request };
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
    const resolution = await resolvePortalPatient(session);
    const consentRequired = await isConsentRequired(resolution);
    // Pending requests belong to the verified email itself, so they never depend on a patient or a consent.
    const requests = await portalRequestService.list(session);
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
