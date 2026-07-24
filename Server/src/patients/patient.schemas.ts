import { PatientStatus } from '../../generated/prisma/client.ts';
import { z } from 'zod';
import { e164OrEmpty } from '../utils/validation/middleware.js';
import { includeDeletedQuery } from '../utils/validation/schemas.js';

export const createPatientSchema = z.object({
  name: z.string().min(1, 'name is required').max(100),
  lastName: z.string().min(1, 'lastName is required').max(100),
  whatsappNumber: e164OrEmpty,
  smsNumber: e164OrEmpty,
  email: z.email('Must be a valid email address').nullish(),
  notes: z.string().max(1000).nullish(),
  status: z.enum(PatientStatus).default(PatientStatus.ACTIVE),
  appointmentTypeId: z.uuid('Invalid appointmentTypeId').nullish(),
});

export const updatePatientSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  whatsappNumber: e164OrEmpty,
  smsNumber: e164OrEmpty,
  email: z.email('Must be a valid email address').nullish(),
  notes: z.string().max(1000).nullish(),
  status: z.enum(PatientStatus).optional(),
  appointmentTypeId: z.uuid('Invalid appointmentTypeId').nullish(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

export const listPatientsSchema = z.object({
  status: z.union([
    z.enum(PatientStatus),
    z.array(z.enum(PatientStatus))
  ]).optional(),
  search: z.string().trim().max(100).optional().transform(v => v === "" ? undefined : v), page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  orderBy: z.enum([ 'name', 'lastName', 'email', 'createdAt', 'updatedAt' ]).default('createdAt'),
  order: z.enum([ 'asc', 'desc' ]).default('desc'),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
}).extend(includeDeletedQuery.shape);

export const patientStatsSchema = z.object({}).extend(includeDeletedQuery.shape);

export type CreatePatientDto = z.infer<typeof createPatientSchema>;
export type UpdatePatientDto = z.infer<typeof updatePatientSchema>;
export type ListPatientsQuery = z.infer<typeof listPatientsSchema>;
export type PatientStatsQuery = z.infer<typeof patientStatsSchema>;
