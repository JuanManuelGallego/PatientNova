import { z } from 'zod';
import { includeDeletedQuery } from '../utils/schemas.js';

export const createAppointmentTypeSchema = z.object({
  name: z.string().min(1, 'name is required').max(100),
  description: z.string().max(500).nullable().optional(),
  defaultDuration: z.number().int().min(1).default(60),
  defaultPrice: z.number().int().min(0).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
});

export const updateAppointmentTypeSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    defaultDuration: z.number().int().min(1).optional(),
    defaultPrice: z.number().int().min(0).nullable().optional(),
    color: z.string().max(20).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (d) => Object.keys(d).length > 0,
    { message: 'At least one valid field must be provided for update' }
  );

export type CreateAppointmentTypeDto= z.infer<typeof createAppointmentTypeSchema>;
export type UpdateAppointmentTypeDto = z.infer<typeof updateAppointmentTypeSchema>;

export const listAppointmentTypesSchema = z.object({}).extend(includeDeletedQuery.shape);

export type ListAppointmentTypesQuery = z.infer<typeof listAppointmentTypesSchema>;
