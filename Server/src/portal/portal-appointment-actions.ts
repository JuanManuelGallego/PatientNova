import { RecordSource, type AppointmentStatus } from '../../generated/prisma/enums.js';
import { ACTIVE_STATUSES } from '../appointments/appointment-status.js';

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
  appointmentType: Bookable | null;
  appointmentLocation: (Bookable & { isVirtual: boolean }) | null;
}

export interface PortalActionContext {
  now: Date;
  /** Booking is live and in auto-confirm mode: the only mode in which a patient may pick a new slot. */
  canBook: boolean;
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
    && isBookable(a.appointmentType)
    && isBookable(a.appointmentLocation)
    && !a.appointmentLocation!.isVirtual;
}
