import { BookingApprovalMode, RecordSource, type AppointmentStatus } from '../../generated/prisma/enums.js';
import { ACTIVE_STATUSES } from '../appointments/appointment-status.js';
import { ONE_HOUR_MS } from '../utils/config/constants.js';

interface Bookable {
  bookableOnline: boolean;
  isActive: boolean;
  isDeleted: boolean;
}

export interface ActionableAppointment {
  status: AppointmentStatus;
  isDeleted: boolean;
  startAt: Date;
  source: RecordSource;
  patientRescheduleCount: number;
  appointmentType: Bookable | null;
  appointmentLocation: Bookable | null;
}

export interface PortalActionContext {
  now: Date;
  /** Booking is live and in auto-confirm mode: the only mode in which a patient may pick a new slot. */
  canBook: boolean;
  maxReschedules: number;
  minNoticeMs: number;
}

export interface PortalActionSettings {
  bookingApprovalMode: BookingApprovalMode;
  maxPatientReschedules: number;
  minRescheduleNoticeHours: number;
}

export function portalActionContext(settings: PortalActionSettings, bookingLive: boolean, now: Date): PortalActionContext {
  return {
    now,
    canBook: bookingLive && settings.bookingApprovalMode === BookingApprovalMode.AUTO_CONFIRM,
    maxReschedules: settings.maxPatientReschedules,
    minNoticeMs: settings.minRescheduleNoticeHours * ONE_HOUR_MS,
  };
}

const isBookable = (b: Bookable | null): boolean => !!b && b.bookableOnline && b.isActive && !b.isDeleted;

/** No cutoff: any upcoming active appointment of the patient, provider-created ones included. */
export function canCancel(a: Pick<ActionableAppointment, 'status' | 'isDeleted' | 'startAt'>, now: Date): boolean {
  return !a.isDeleted && ACTIVE_STATUSES.has(a.status) && a.startAt.getTime() > now.getTime();
}

/**
 * Only the patient's own online bookings, and only while their type and location are still bookable,
 * so a provider's appointment is never moved into a slot the provider did not open.
 */
export function canReschedule(a: ActionableAppointment, ctx: PortalActionContext): boolean {
  return ctx.canBook
    && canCancel(a, ctx.now)
    && a.source === RecordSource.PORTAL
    && a.patientRescheduleCount < ctx.maxReschedules
    && a.startAt.getTime() - ctx.now.getTime() > ctx.minNoticeMs
    && isBookable(a.appointmentType)
    && isBookable(a.appointmentLocation);
}
