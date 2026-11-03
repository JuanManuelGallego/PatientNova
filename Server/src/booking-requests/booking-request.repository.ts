import { BookingRequestStatus, type BookingRequestKind } from '../../generated/prisma/client.ts';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import type { Interval } from '../public-booking/slot-engine.js';

const MINUTE_MS = 60_000;

export interface LiveHoldOptions {
  /** The request being resolved: it must not block itself. */
  excludeRequestId?: string | undefined;
}

export interface CreateBookingRequestData {
  userId: string;
  kind?: BookingRequestKind;
  email: string;
  name: string;
  lastName: string;
  phone?: string | null;
  typeId: string;
  locationId: string;
  startAt: Date;
  endAt: Date;
  patientTimezone: string;
  holdExpiresAt: Date;
  policyVersion: string;
  consentAcceptedAt: Date;
  consentIp?: string | null;
  consentUserAgent?: string | null;
}

/** A hold is live while PENDING and before `holdExpiresAt`; the cron only finalizes the rest. */
function liveHoldWhere(userId: string, now: Date, opts: LiveHoldOptions) {
  return {
    userId,
    status: BookingRequestStatus.PENDING,
    holdExpiresAt: { gt: now },
    ...(opts.excludeRequestId && { NOT: { id: opts.excludeRequestId } }),
  };
}

export const bookingRequestRepository = {
  /** Live holds overlapping `[start, end)` widened by the buffer on both sides, like appointments. */
  async loadLiveHolds(
    userId: string,
    start: Date,
    end: Date,
    bufferMinutes: number,
    now: Date,
    tx?: TransactionClient,
    opts: LiveHoldOptions = {},
  ): Promise<Interval[]> {
    const bufferMs = bufferMinutes * MINUTE_MS;
    const holds = await (tx ?? prisma).bookingRequest.findMany({
      where: {
        ...liveHoldWhere(userId, now, opts),
        startAt: { lt: new Date(end.getTime() + bufferMs) },
        endAt: { gt: new Date(start.getTime() - bufferMs) },
      },
      select: { startAt: true, endAt: true },
    });
    return holds.map((h) => ({ start: h.startAt, end: h.endAt }));
  },

  /** First live hold overlapping `[start, end)` exactly (no buffer), or null. */
  async findLiveHoldOverlap(
    userId: string,
    start: Date,
    end: Date,
    now: Date,
    tx: TransactionClient,
    opts: LiveHoldOptions = {},
  ): Promise<{ startAt: Date; endAt: Date } | null> {
    return tx.bookingRequest.findFirst({
      where: { ...liveHoldWhere(userId, now, opts), startAt: { lt: end }, endAt: { gt: start } },
      select: { startAt: true, endAt: true },
    });
  },

  /** PENDING rows whose hold has run out, oldest first. */
  async findStale(userId: string, now: Date, tx: TransactionClient) {
    return tx.bookingRequest.findMany({
      where: { userId, status: BookingRequestStatus.PENDING, holdExpiresAt: { lte: now } },
      select: { id: true, holdExpiresAt: true },
      orderBy: { holdExpiresAt: 'asc' },
    });
  },

  async markExpired(ids: string[], now: Date, tx: TransactionClient): Promise<void> {
    if (ids.length === 0) return;
    await tx.bookingRequest.updateMany({
      where: { id: { in: ids }, status: BookingRequestStatus.PENDING },
      data: { status: BookingRequestStatus.EXPIRED, resolvedAt: now },
    });
  },

  async create(data: CreateBookingRequestData, tx: TransactionClient) {
    return tx.bookingRequest.create({
      data: {
        userId: data.userId,
        kind: data.kind ?? 'NEW',
        email: data.email,
        name: data.name,
        lastName: data.lastName,
        phone: data.phone ?? null,
        typeId: data.typeId,
        locationId: data.locationId,
        startAt: data.startAt,
        endAt: data.endAt,
        patientTimezone: data.patientTimezone,
        holdExpiresAt: data.holdExpiresAt,
        policyVersion: data.policyVersion,
        consentAcceptedAt: data.consentAcceptedAt,
        consentIp: data.consentIp?.slice(0, 64) ?? null,
        consentUserAgent: data.consentUserAgent?.slice(0, 512) ?? null,
      },
    });
  },
};
