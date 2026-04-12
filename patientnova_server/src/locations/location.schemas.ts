import { z } from 'zod';

export const createLocationSchema = z.object({
  name: z.string().min(1, 'name is required').max(100),
  address: z.string().max(255).nullable().optional(),
  meetingUrl: z.string().url('meetingUrl must be a valid URL').max(500).or(z.literal('')).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  bg: z.string().max(20).nullable().optional(),
  dot: z.string().max(20).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  defaultPrice: z.number().int().min(0).nullable().optional(),
  isVirtual: z.boolean().default(false),
});

export const updateLocationSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    address: z.string().max(255).nullable().optional(),
    meetingUrl: z.string().url('meetingUrl must be a valid URL').max(500).or(z.literal('')).nullable().optional(),
    color: z.string().max(20).nullable().optional(),
    bg: z.string().max(20).nullable().optional(),
    dot: z.string().max(20).nullable().optional(),
    icon: z.string().max(50).nullable().optional(),
    defaultPrice: z.number().int().min(0).nullable().optional(),
    isVirtual: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (d) => Object.keys(d).length > 0,
    { message: 'At least one valid field must be provided for update' }
  );

export const uuidParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type CreateLocationDto = z.infer<typeof createLocationSchema>;
export type UpdateLocationDto = z.infer<typeof updateLocationSchema>;
