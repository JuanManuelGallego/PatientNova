import { AppointmentStatus, BookingApprovalMode, Channel, PatientStatus, RecordSource } from '../../generated/prisma/enums.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import { isAppointmentOverlapViolation } from '../utils/errors/prisma-errors.js';
import { ONE_MINUTE_MS } from '../utils/config/constants.js';
import { runInAuditContext } from '../audit-log/audit-log-context.js';
import { portalPatientAuditContext } from '../audit-log/audit-actors.js';
import { bookingSettingsRepository } from '../booking-settings/booking-settings.repository.js';
import { bookingSettingsService } from '../booking-settings/booking-settings.service.js';
import { publicBookingRepository } from '../public-booking/public-booking.repository.js';
import { isSlotAvailable } from '../public-booking/slot-engine.js';
import {
  ProviderNotFoundError,
  PublicAppointmentTypeNotFoundError,
  PublicLocationNotFoundError,
} from '../public-booking/public-booking.errors.js';
import { createWithin } from '../appointments/appointment.service.js';
import { AppointmentBlockedTimeConflictError, AppointmentConflictError } from '../appointments/appointment.errors.js';
import { createPatientWithin } from '../patients/patient.service.js';
import { PatientLimitReachedError } from '../patients/patient.errors.js';
import { ensureCurrentConsent, type ConsentRequestMeta } from '../patient-consents/patient-consent.service.js';
import { resolvePortalPatient } from './patient-resolution.js';
import { PRIVACY_POLICY_VERSION } from './privacy-policy.js';
import { isConsentRequired } from './portal-session.service.js';
import { portalBookingRepository } from './portal-booking.repository.js';
import { PortalBookingLimitError, PortalBookingUnavailableError, SlotUnavailableError } from './portal-booking.errors.js';
import type { CreatePortalBookingBody } from './portal-booking.schemas.js';
import type { PortalSessionContext } from './portal-session.middleware.js';

/** Upcoming portal-sourced appointments one patient may hold at a time. */
export const MAX_UPCOMING_PORTAL_BOOKINGS = 3;

export interface PortalAppointmentDto {
  id: string;
  startUtc: string;
  endUtc: string;
  durationMinutes: number;
  status: AppointmentStatus;
  price: number;
  type: { name: string } | null;
  location: { name: string; address: string | null; instructions: string | null } | null;
}

type PortalAppointmentRow = {
  id: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  price: number;
  appointmentType: { name: string } | null;
  appointmentLocation: { name: string; address: string | null; instructions: string | null } | null;
};

function toPortalAppointmentDto(a: PortalAppointmentRow): PortalAppointmentDto {
  return {
    id: a.id,
    startUtc: a.startAt.toISOString(),
    endUtc: a.endAt.toISOString(),
    durationMinutes: Math.round((a.endAt.getTime() - a.startAt.getTime()) / ONE_MINUTE_MS),
    status: a.status,
    price: a.price,
    type: a.appointmentType ? { name: a.appointmentType.name } : null,
    location: a.appointmentLocation
      ? { name: a.appointmentLocation.name, address: a.appointmentLocation.address, instructions: a.appointmentLocation.instructions }
      : null,
  };
}

// Conflicts from createWithin carry the other appointment's times; the portal answers one neutral 409.
function toPortalError(err: unknown): unknown {
  if (
    err instanceof AppointmentConflictError
    || err instanceof AppointmentBlockedTimeConflictError
    || isAppointmentOverlapViolation(err)
  ) return new SlotUnavailableError();
  if (err instanceof PatientLimitReachedError) return new PortalBookingUnavailableError();
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
  /**
   * Books a slot in one transaction: provider lock → live check → bookable type/location →
   * isSlotAvailable → resolve or create the patient → cap → consent → createWithin.
   */
  async book(session: PortalSessionContext, body: CreatePortalBookingBody, meta: ConsentRequestMeta): Promise<PortalAppointmentDto> {
    const { userId } = session;
    const auditContext = portalPatientAuditContext({ userId, email: session.email, ipAddress: meta.ipAddress });
    const start = new Date(body.startUtc);

    try {
      const created = await runInAuditContext(auditContext, () => prisma.$transaction(async (tx) => {
        await withProviderLock(tx, userId);
        const settings = await bookingSettingsRepository.getSettings(userId, tx);
        if (settings.bookingApprovalMode !== BookingApprovalMode.AUTO_CONFIRM || !(await bookingSettingsService.isBookingLive(userId, tx))) {
          throw new ProviderNotFoundError();
        }

        const type = await publicBookingRepository.findBookableType(userId, body.typeId, tx);
        if (!type) throw new PublicAppointmentTypeNotFoundError();
        const location = await publicBookingRepository.findBookableLocation(userId, body.locationId, tx);
        if (!location) throw new PublicLocationNotFoundError();

        const now = new Date();
        const end = new Date(start.getTime() + type.defaultDuration * ONE_MINUTE_MS);
        const rules = await bookingSettingsRepository.listRules(userId, tx);
        const busy = await publicBookingRepository.loadBusy(userId, start, end, settings.bufferMinutes, tx);
        const available = isSlotAvailable(start, {
          timezone: settings.timezone,
          rules,
          durationMinutes: type.defaultDuration,
          slotIntervalMinutes: settings.slotIntervalMinutes,
          bufferMinutes: settings.bufferMinutes,
          minLeadMinutes: settings.minLeadMinutes,
          maxHorizonDays: settings.maxHorizonDays,
          now,
          busy: { ...busy, holds: [] },
        });
        if (!available) throw new SlotUnavailableError();

        const patientId = await resolveOrCreatePatient(tx, session, body.patient);
        if (await portalBookingRepository.countUpcomingPortal(userId, patientId, now, tx) >= MAX_UPCOMING_PORTAL_BOOKINGS) {
          throw new PortalBookingLimitError();
        }
        await ensureCurrentConsent(tx, { patientId, userId }, PRIVACY_POLICY_VERSION, meta);

        return createWithin(tx, {
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          price: type.defaultPrice ?? 0,
          paid: false,
          status: AppointmentStatus.CONFIRMED,
          patientId,
          locationId: location.id,
          typeId: type.id,
        }, userId, { source: RecordSource.PORTAL, patientTimezone: body.patientTimezone });
      }, { timeout: 10000 }));
      return toPortalAppointmentDto(created);
    } catch (err) {
      throw toPortalError(err);
    }
  },

  /** Same shape for every resolution; only a consented patient gets their upcoming appointments. */
  async listAppointments(session: PortalSessionContext): Promise<{ appointments: PortalAppointmentDto[]; consentRequired: boolean }> {
    const resolution = await resolvePortalPatient(session);
    const consentRequired = await isConsentRequired(resolution);
    if (resolution.kind !== 'patient' || consentRequired) return { appointments: [], consentRequired: true };
    const rows = await portalBookingRepository.listUpcoming(session.userId, resolution.patientId, new Date());
    return { appointments: rows.map(toPortalAppointmentDto), consentRequired };
  },
};
