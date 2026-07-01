import { z } from 'zod';

/**
 * Shared UUID route-param schema.
 * Import this instead of redefining it in each feature module.
 */
export const uuidParamSchema = z.object({
  id: z.uuid('id must be a valid UUID'),
});

export type UuidParam = z.infer<typeof uuidParamSchema>;

/**
 * Shared query schema for the `includeDeleted` flag.
 * When false (default), only active/non-deleted records are returned.
 * When true, all records including deleted ones are returned.
 */
export const includeDeletedQuery = z.object({
  includeDeleted: z.enum(['true', 'false']).transform(v => v === 'true').default(false),
});

export type IncludeDeletedQuery = z.infer<typeof includeDeletedQuery>;
