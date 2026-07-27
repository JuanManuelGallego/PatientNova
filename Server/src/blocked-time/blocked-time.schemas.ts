import { z } from 'zod';
import { includeDeletedQuery } from '../utils/validation/schemas.js';

export const createBlockedTimeSchema = z.object({
  description: z.string().min(1).max(255).nullish(),
  startTimeUtc: z.iso.datetime(),
  endTimeUtc: z.iso.datetime(),
}).refine(
  (d) => new Date(d.endTimeUtc) > new Date(d.startTimeUtc),
  { message: 'endTimeUtc must be after startTimeUtc', path: ['endTimeUtc'] },
);

export const updateBlockedTimeSchema = z.object({
  description: z.string().min(1).max(255).nullish(),
  startTimeUtc: z.iso.datetime().optional(),
  endTimeUtc: z.iso.datetime().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' },
).refine(
  (d) => {
    if (d.startTimeUtc !== undefined && d.endTimeUtc !== undefined) {
      return new Date(d.endTimeUtc) > new Date(d.startTimeUtc);
    }
    return true;
  },
  { message: 'endTimeUtc must be after startTimeUtc', path: ['endTimeUtc'] },
);

export const listBlockedTimeSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(250).default(20),
  orderBy: z.enum(['startTimeUtc', 'endTimeUtc', 'createdAt', 'updatedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
}).extend(includeDeletedQuery.shape);

export type CreateBlockedTimeDto = z.infer<typeof createBlockedTimeSchema>;
export type UpdateBlockedTimeDto = z.infer<typeof updateBlockedTimeSchema>;
export type ListBlockedTimeQuery = z.infer<typeof listBlockedTimeSchema>;
