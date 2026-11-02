import type { AppointmentStatus } from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ONE_MINUTE_MS } from '../utils/config/constants.js';
import type { portalAppointmentSelect } from './portal-booking.repository.js';
import { canCancel, canReschedule, type PortalActionContext } from './portal-appointment-actions.js';

/** The only appointment shape a patient ever sees (allow-list). */
export interface PortalAppointmentDto {
  id: string;
  startUtc: string;
  endUtc: string;
  durationMinutes: number;
  status: AppointmentStatus;
  price: number;
  type: { name: string } | null;
  location: { name: string; address: string | null; instructions: string | null } | null;
  /** Computed on the server; the Portal shows actions only from these flags. */
  canCancel: boolean;
  canReschedule: boolean;
}

export type PortalAppointmentRow = Prisma.AppointmentGetPayload<{ select: typeof portalAppointmentSelect }>;

export function toPortalAppointmentDto(a: PortalAppointmentRow, ctx: PortalActionContext): PortalAppointmentDto {
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
    canCancel: canCancel(a, ctx.now),
    canReschedule: canReschedule(a, ctx),
  };
}
