import type { BookingRequestStatus } from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ONE_MINUTE_MS } from '../utils/config/constants.js';
import type { requestForDtoSelect } from '../booking-requests/booking-request.repository.js';

export interface PortalRequestDto {
  id: string;
  status: BookingRequestStatus;
  startUtc: string;
  endUtc: string;
  durationMinutes: number;
  holdExpiresAt: string;
  type: { name: string };
  location: { name: string; address: string | null; isVirtual: boolean };
}

export type PortalRequestRow = Prisma.BookingRequestGetPayload<{ select: typeof requestForDtoSelect }>;

export function toPortalRequestDto(r: PortalRequestRow): PortalRequestDto {
  return {
    id: r.id,
    status: r.status,
    startUtc: r.startAt.toISOString(),
    endUtc: r.endAt.toISOString(),
    durationMinutes: Math.round((r.endAt.getTime() - r.startAt.getTime()) / ONE_MINUTE_MS),
    holdExpiresAt: r.holdExpiresAt.toISOString(),
    type: { name: r.type.name },
    location: { name: r.location.name, address: r.location.isVirtual ? null : r.location.address, isVirtual: r.location.isVirtual },
  };
}
