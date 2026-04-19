import { prisma } from '../prisma/prismaClient.js';
import type { Prisma } from '@prisma/client';

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Constructs a pagination result from already-resolved data. Pure; no DB calls. */
export function buildPaginatedResult<T>(data: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

/**
 * Runs a paginated Prisma query inside a transaction and wraps the result.
 * Both queries must be built with the same `where` clause to keep counts consistent.
 */
export async function paginate<T>(
  dataQuery: Prisma.PrismaPromise<T[]>,
  countQuery: Prisma.PrismaPromise<number>,
  page: number,
  pageSize: number,
): Promise<Paginated<T>> {
  const [data, total] = await prisma.$transaction([dataQuery, countQuery]);
  return buildPaginatedResult(data, total, page, pageSize);
}
