import { z } from 'zod';

/**
 * Shared UUID route-param schema.
 * Import this instead of redefining it in each feature module.
 */
export const uuidParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type UuidParam = z.infer<typeof uuidParamSchema>;
