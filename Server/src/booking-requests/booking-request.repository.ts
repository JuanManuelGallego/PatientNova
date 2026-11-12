import { BookingRequestStatus, type BookingRequestKind, type Channel, type Prisma } from '../../generated/prisma/client.ts';
import type { BookingRequestTab } from './booking-request.schemas.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import type { Interval } from '../public-booking/slot-engine.js';

const MINUTE_MS = 60_000;

export interface LiveHoldOptions {
  excludeRequestId?: string | undefined;
}

export interface CreateBookingRequestData {
  userId: string;
  kind?: BookingRequestKind;
  contactChannel?: Channel;
  email: string | null;
  verifiedPhone?: string | null;
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

export const requestForDtoSelect = {
  id: true,
  status: true,
  startAt: true,
  endAt: true,
  holdExpiresAt: true,
  type: { select: { name: true } },
  location: { select: { name: true, address: true, isVirtual: true } },
} as const;

/** Provider inbox rows: typed patient details are shown to the provider (never to other patients or in audits). */
export const providerRequestSelect = {
  id: true,
  kind: true,
  status: true,
  createdAt: true,
  startAt: true,
  endAt: true,
  holdExpiresAt: true,
  resolvedAt: true,
  name: true,
  lastName: true,
  contactChannel: true,
  email: true,
  verifiedPhone: true,
  phone: true,
  patientTimezone: true,
  appointmentId: true,
  patientId: true,
  type: { select: { id: true, name: true } },
  location: { select: { id: true, name: true, isVirtual: true } },
} as const;

export const providerRequestDetailSelect = {
  ...providerRequestSelect,
  emailHash: true,
  verifiedPhoneHash: true,
  policyVersion: true,
  consentAcceptedAt: true,
  consentIp: true,
  consentUserAgent: true,
} as const;

export const HOLDING_STATUSES = [ BookingRequestStatus.PENDING, BookingRequestStatus.UNCONFIRMED ];

const RESOLVED_STATUSES = [ BookingRequestStatus.APPROVED, BookingRequestStatus.REJECTED, BookingRequestStatus.CANCELLED ];

function tabWhere(tab: BookingRequestTab, now: Date): Prisma.BookingRequestWhereInput {
  switch (tab) {
    case 'pending':
      return { status: BookingRequestStatus.PENDING, confirmedAt: { not: null }, holdExpiresAt: { gt: now } };
    case 'expired':
      return {
        confirmedAt: { not: null },
        OR: [
          { status: BookingRequestStatus.EXPIRED },
          { status: BookingRequestStatus.PENDING, holdExpiresAt: { lte: now } },
        ],
      };
    case 'resolved':
      return { status: { in: RESOLVED_STATUSES }, confirmedAt: { not: null } };
  }
}

function liveHoldWhere(userId: string, now: Date, opts: LiveHoldOptions) {
  return {
    userId,
    status: { in: HOLDING_STATUSES },
    holdExpiresAt: { gt: now },
    ...(opts.excludeRequestId && { NOT: { id: opts.excludeRequestId } }),
  };
}

function selfServeRequestWhere(userId: string, now: Date) {
  return { ...liveHoldWhere(userId, now, {}), status: BookingRequestStatus.PENDING, confirmedAt: { not: null } };
}

export const bookingRequestRepository = {
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

  async findLiveHoldOverlap(
    userId: string,
    start: Date,
    end: Date,
    now: Date,
    tx: TransactionClient,
    opts: LiveHoldOptions = {},
  ): Promise<{ startAt: Date; endAt: Date } | null> {
    return tx.bookingRequest.findFirst({
      where: {
        ...liveHoldWhere(userId, now, opts),
        status: BookingRequestStatus.PENDING,
        confirmedAt: { not: null },
        startAt: { lt: end },
        endAt: { gt: start },
      },
      select: { startAt: true, endAt: true },
    });
  },

  async findStale(userId: string, now: Date, tx: TransactionClient) {
    return tx.bookingRequest.findMany({
      where: { userId, status: { in: HOLDING_STATUSES }, holdExpiresAt: { lte: now } },
      select: { id: true, status: true, confirmedAt: true, confirmationSentAt: true, holdExpiresAt: true },
      orderBy: { holdExpiresAt: 'asc' },
    });
  },

  async markExpired(ids: string[], now: Date, tx: TransactionClient): Promise<void> {
    if (ids.length === 0) return;
    await tx.bookingRequest.updateMany({
      where: { id: { in: ids }, status: { in: HOLDING_STATUSES } },
      data: { status: BookingRequestStatus.EXPIRED, resolvedAt: now },
    });
  },


  async countLive(userId: string, now: Date, tx: TransactionClient, own: Prisma.BookingRequestWhereInput = {}): Promise<number> {
    return tx.bookingRequest.count({ where: { ...liveHoldWhere(userId, now, {}), ...own } });
  },

  async countLivePending(userId: string, now: Date, tx: TransactionClient): Promise<number> {
    return tx.bookingRequest.count({ where: { userId, status: BookingRequestStatus.PENDING, holdExpiresAt: { gt: now } } });
  },

  async countLiveUnconfirmed(userId: string, now: Date, tx: TransactionClient, own: Prisma.BookingRequestWhereInput = {}): Promise<number> {
    return tx.bookingRequest.count({ where: { userId, status: BookingRequestStatus.UNCONFIRMED, holdExpiresAt: { gt: now }, ...own } });
  },

  async countLiveConfirmed(userId: string, now: Date, tx: TransactionClient, own: Prisma.BookingRequestWhereInput): Promise<number> {
    return tx.bookingRequest.count({
      where: { userId, status: BookingRequestStatus.PENDING, confirmedAt: { not: null }, holdExpiresAt: { gt: now }, ...own },
    });
  },

  async countCreatedSince(userId: string, since: Date, tx: TransactionClient, own: Prisma.BookingRequestWhereInput): Promise<number> {
    return tx.bookingRequest.count({ where: { userId, createdAt: { gte: since }, ...own } });
  },

  async listLiveOwn(userId: string, own: Prisma.BookingRequestWhereInput, now: Date, tx?: TransactionClient) {
    return (tx ?? prisma).bookingRequest.findMany({
      where: { ...selfServeRequestWhere(userId, now), ...own },
      select: requestForDtoSelect,
      orderBy: { startAt: 'asc' },
    });
  },

  async findForDto(id: string, tx: TransactionClient) {
    return tx.bookingRequest.findUniqueOrThrow({ where: { id }, select: requestForDtoSelect });
  },

  async findLiveOwn(userId: string, own: Prisma.BookingRequestWhereInput, id: string, now: Date, tx: TransactionClient) {
    return tx.bookingRequest.findFirst({
      where: { ...selfServeRequestWhere(userId, now), ...own, id },
      select: { id: true, startAt: true, endAt: true },
    });
  },

  async cancel(id: string, now: Date, tx: TransactionClient, resolvedBy: 'patient' | 'system' = 'patient'): Promise<void> {
    await tx.bookingRequest.update({
      where: { id },
      data: { status: BookingRequestStatus.CANCELLED, resolvedAt: now, resolvedBy },
    });
  },

  async markConfirmedPending(
    id: string,
    data: { kind: BookingRequestKind; confirmedAt: Date; holdExpiresAt: Date },
    tx: TransactionClient,
  ): Promise<void> {
    await tx.bookingRequest.update({ where: { id }, data: { ...data, status: BookingRequestStatus.PENDING } });
  },

  async create(data: CreateBookingRequestData, tx: TransactionClient) {
    return tx.bookingRequest.create({
      data: {
        userId: data.userId,
        kind: data.kind ?? 'NEW',
        contactChannel: data.contactChannel ?? 'EMAIL',
        email: data.email,
        verifiedPhone: data.verifiedPhone ?? null,
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
        confirmedAt: data.consentAcceptedAt,
      },
    });
  },

  async createUnconfirmed(data: CreateBookingRequestData & { confirmTokenHash: string; releaseTokenHash: string }, tx: TransactionClient) {
    return tx.bookingRequest.create({
      data: {
        userId: data.userId,
        kind: data.kind ?? 'NEW',
        status: BookingRequestStatus.UNCONFIRMED,
        contactChannel: data.contactChannel ?? 'EMAIL',
        email: data.email,
        verifiedPhone: data.verifiedPhone ?? null,
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
        confirmTokenHash: data.confirmTokenHash,
        releaseTokenHash: data.releaseTokenHash,
      },
    });
  },

  async findByConfirmTokenHash(hash: string, tx?: TransactionClient) {
    return (tx ?? prisma).bookingRequest.findUnique({ where: { confirmTokenHash: hash } });
  },

  async findByReleaseTokenHash(hash: string, tx: TransactionClient) {
    return tx.bookingRequest.findUnique({ where: { releaseTokenHash: hash } });
  },

  async markConfirmationSent(id: string, now: Date): Promise<void> {
    await prisma.bookingRequest.update({ where: { id }, data: { confirmationSentAt: now } });
  },

  async listForProvider(
    userId: string,
    query: { status: BookingRequestTab; from?: string | undefined; to?: string | undefined; page: number; pageSize: number },
    now: Date,
  ) {
    const where: Prisma.BookingRequestWhereInput = {
      userId,
      ...tabWhere(query.status, now),
      ...((query.from || query.to) && {
        startAt: { ...(query.from && { gte: new Date(query.from) }), ...(query.to && { lt: new Date(query.to) }) },
      }),
    };
    const orderBy: Prisma.BookingRequestOrderByWithRelationInput[] = query.status === 'pending'
      ? [ { startAt: 'asc' }, { id: 'asc' } ]
      : [ { updatedAt: 'desc' }, { id: 'asc' } ];
    const [ rows, total ] = await prisma.$transaction([
      prisma.bookingRequest.findMany({
        where,
        select: providerRequestSelect,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.bookingRequest.count({ where }),
    ]);
    return { rows, total };
  },

  async findForProvider(userId: string, id: string, tx?: TransactionClient) {
    return (tx ?? prisma).bookingRequest.findFirst({ where: { id, userId, confirmedAt: { not: null } }, select: providerRequestDetailSelect });
  },

  async countPending(userId: string, now: Date): Promise<number> {
    return prisma.bookingRequest.count({
      where: { userId, status: BookingRequestStatus.PENDING, confirmedAt: { not: null }, holdExpiresAt: { gt: now } },
    });
  },

  async resolve(
    id: string,
    data: {
      status: typeof BookingRequestStatus.APPROVED | typeof BookingRequestStatus.REJECTED;
      resolvedAt: Date;
      resolvedBy: string;
      appointmentId?: string;
      patientId?: string;
    },
    tx: TransactionClient,
  ): Promise<void> {
    await tx.bookingRequest.update({ where: { id }, data });
  },

  async providersWithStale(now: Date): Promise<string[]> {
    const rows = await prisma.bookingRequest.findMany({
      where: { status: { in: HOLDING_STATUSES }, holdExpiresAt: { lte: now } },
      select: { userId: true },
      distinct: [ 'userId' ],
    });
    return rows.map((r) => r.userId);
  },

  /** Live, un-nudged holds expiring within `windowMs`; the caller keeps those past the middle of their hold. */
  async findNudgeCandidates(now: Date, windowMs: number) {
    return prisma.bookingRequest.findMany({
      where: {
        status: BookingRequestStatus.PENDING,
        confirmedAt: { not: null },
        nudgedAt: null,
        holdExpiresAt: { gt: now, lte: new Date(now.getTime() + windowMs) },
      },
      select: { id: true, createdAt: true, holdExpiresAt: true },
    });
  },

  /** Claims the nudge: only rows still PENDING and un-nudged, so a concurrent sweep cannot nudge twice. */
  async markNudged(id: string, now: Date, tx: TransactionClient): Promise<boolean> {
    const { count } = await tx.bookingRequest.updateMany({
      where: { id, status: BookingRequestStatus.PENDING, nudgedAt: null },
      data: { nudgedAt: now },
    });
    return count === 1;
  },

  async purgeResolvedBefore(before: Date): Promise<number> {
    const { count } = await prisma.bookingRequest.deleteMany({
      where: { status: { notIn: HOLDING_STATUSES }, updatedAt: { lt: before } },
    });
    return count;
  },

  async purgeUnconfirmedBefore(before: Date): Promise<number> {
    const { count } = await prisma.bookingRequest.deleteMany({
      where: { confirmedAt: null, status: { notIn: HOLDING_STATUSES }, updatedAt: { lt: before } },
    });
    return count;
  },
};
