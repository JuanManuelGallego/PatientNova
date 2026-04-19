import { PatientStatus } from '@prisma/client';
import { z } from 'zod';
import { e164OrEmpty } from '../utils/types.js';

export const createPatientSchema = z.object({
  name: z.string().min(1, 'name is required').max(100),
  lastName: z.string().min(1, 'lastName is required').max(100),
  whatsappNumber: e164OrEmpty,
  smsNumber: e164OrEmpty,
  email: z.string().email('Must be a valid email address').nullish(),
  notes: z.string().max(500).nullish(),
  status: z.nativeEnum(PatientStatus).default(PatientStatus.ACTIVE),
});

export const updatePatientSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  whatsappNumber: e164OrEmpty,
  smsNumber: e164OrEmpty,
  email: z.string().email('Must be a valid email address').nullish(),
  notes: z.string().max(500).nullish(),
  status: z.nativeEnum(PatientStatus).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

export const listPatientsSchema = z.object({
  status: z.union([
    z.nativeEnum(PatientStatus),
    z.array(z.nativeEnum(PatientStatus))
  ]).optional(),
  search: z.string().trim().max(100).optional().transform(v => v === "" ? undefined : v), page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  orderBy: z.enum([ 'name', 'lastName', 'email', 'createdAt', 'updatedAt' ]).default('createdAt'),
  order: z.enum([ 'asc', 'desc' ]).default('desc'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type CreatePatientDto = z.infer<typeof createPatientSchema>;
export type UpdatePatientDto = z.infer<typeof updatePatientSchema>;
export type ListPatientsQuery = z.infer<typeof listPatientsSchema>;
