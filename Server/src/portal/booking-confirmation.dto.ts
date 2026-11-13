import type { Channel } from '../../generated/prisma/enums.js';

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
