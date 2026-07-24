import { z } from 'zod';
import { includeDeletedQuery } from '../utils/validation/schemas.js';

export const createLocationSchema = z
  .object({
    name: z.string().min(1, 'name is required').max(100),
    address: z.string().max(255).nullable().optional(),
    instructions: z.string().max(500).nullable().optional(),
    color: z.string().max(20).nullable().optional(),
    defaultPrice: z.number().int().min(0).nullable().optional(),
    isVirtual: z.boolean().default(false),
  })
  .superRefine((d, ctx) => {
    if (!d.isVirtual) {
      if (!d.address) {
        ctx.addIssue({
          code: "custom",
          message: 'address is required for non-virtual locations',
          path: [ 'address' ],
        });
      }
      if (!d.instructions) {
        ctx.addIssue({
          code: "custom",
          message: 'instructions is required for non-virtual locations',
          path: [ 'instructions' ],
        });
      }
    }
  });

export const updateLocationSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    address: z.string().max(255).nullable().optional(),
    instructions: z.string().max(500).nullable().optional(),
    color: z.string().max(20).nullable().optional(),
    defaultPrice: z.number().int().min(0).nullable().optional(),
    isVirtual: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((d, ctx) => {
    if (Object.keys(d).length === 0) {
      ctx.addIssue({
        code: "custom",
        message: 'At least one valid field must be provided for update',
      });
    }

    if (d.isVirtual === false) {
      if (!d.address) {
        ctx.addIssue({
          code: "custom",
          message: 'address is required when setting location to non-virtual',
          path: [ 'address' ],
        });
      }
      if (!d.instructions) {
        ctx.addIssue({
          code: "custom",
          message: 'instructions is required when setting location to non-virtual',
          path: [ 'instructions' ],
        });
      }
    }
  });

export type CreateLocationDto = z.infer<typeof createLocationSchema>;
export type UpdateLocationDto = z.infer<typeof updateLocationSchema>;

export const listLocationsSchema = z.object({}).extend(includeDeletedQuery.shape);

export type ListLocationsQuery = z.infer<typeof listLocationsSchema>;
