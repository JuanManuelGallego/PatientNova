import { type BlockedTime, type Prisma } from '../../generated/prisma/client.ts';
import { prisma } from '../utils/prisma/prisma-client.js';
import { BlockedTimeNotFoundError } from './blocked-time.errors.js';
import { buildUpdateData } from '../utils/prisma/build-update-data.js';
import { softDelete, restore } from '../utils/prisma/softDelete.js';
import { paginate, type Paginated } from '../utils/api/pagination.js';
import type { CreateBlockedTimeDto, UpdateBlockedTimeDto, ListBlockedTimeQuery } from './blocked-time.schemas.js';

export const blockedTimeRepository = {
  async create(dto: CreateBlockedTimeDto, userId: string): Promise<BlockedTime> {
    return prisma.blockedTime.create({
      data: {
        userId,
        description: dto.description,
        startTimeUtc: dto.startTimeUtc,
        endTimeUtc: dto.endTimeUtc,
      },
    });
  },

  async findById(id: string, userId: string, includeDeleted = false): Promise<BlockedTime> {
    const blockedTime = await prisma.blockedTime.findFirst({
      where: { id, userId, ...(includeDeleted ? {} : { isDeleted: false }) },
    });
    if (!blockedTime) throw new BlockedTimeNotFoundError(id);
    return blockedTime;
  },

  async findMany(userId: string, query: ListBlockedTimeQuery): Promise<Paginated<BlockedTime>> {
    const { from, to, page, pageSize, orderBy, order, includeDeleted } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.BlockedTimeWhereInput = {
      userId,
      ...(includeDeleted ? {} : { isDeleted: false }),
      ...(from || to ? {
        startTimeUtc: {
          ...(from && { gte: from }),
          ...(to && { lte: to }),
        },
      } : {}),
    };

    return paginate(
      prisma.blockedTime.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [orderBy]: order },
      }),
      prisma.blockedTime.count({ where }),
      page,
      pageSize,
    );
  },

  async update(id: string, dto: UpdateBlockedTimeDto, userId: string): Promise<BlockedTime> {
    await blockedTimeRepository.findById(id, userId);

    const data = buildUpdateData(
      dto,
      ['description', 'startTimeUtc', 'endTimeUtc'],
    );

    return prisma.blockedTime.update({
      where: { id },
      data,
    });
  },

  async delete(id: string, userId: string): Promise<BlockedTime> {
    await blockedTimeRepository.findById(id, userId);
    return softDelete(prisma.blockedTime, id, userId) as Promise<BlockedTime>;
  },

  async restore(id: string, userId: string): Promise<BlockedTime> {
    await blockedTimeRepository.findById(id, userId);
    return restore(prisma.blockedTime, id, userId) as Promise<BlockedTime>;
  },

  async hasBlockedTimeOverlap(userId: string, startAt: Date, endAt: Date): Promise<{ id: string; description: string | null; startTimeUtc: Date; endTimeUtc: Date } | null> {
    return prisma.blockedTime.findFirst({
      where: {
        userId,
        isDeleted: false,
        startTimeUtc: { lt: endAt },
        endTimeUtc: { gt: startAt },
      },
      select: { id: true, description: true, startTimeUtc: true, endTimeUtc: true },
    });
  },
};
