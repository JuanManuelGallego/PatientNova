import { AppointmentStatus } from '@prisma/client';
import { z } from 'zod';

export enum ReminderType {
  NONE = "NINGUNO",
  ONE_HOUR_BEFORE = "1_HORA_ANTES",
  ONE_DAY_BEFORE = "1_DIA_ANTES",
  ONE_WEEK_BEFORE = "1_SEMANA_ANTES",
}

export const createAppointmentSchema = z.object({
  patientId: z.string().uuid('patientId must be a valid UUID'),
  date: z.string().datetime(),
  status: z.nativeEnum(AppointmentStatus).default(AppointmentStatus.SCHEDULED),
  type: z.string().min(1, 'type is required').max(120),
  location: z.string().min(1, 'location is required').max(255),
  meetingUrl: z.string().url('meetingUrl must be a valid URL').optional().or(z.literal('')),
  price: z.string().min(1, 'price is required').max(20),
  payed: z.boolean().default(false),
  duration: z.string().min(1, 'duration is required').max(20),
  reminderId: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).optional(),
});

export const updateAppointmentSchema = z
  .object({
    patientId: z.string().uuid().optional(),
    date: z.string().datetime(),
    status: z.nativeEnum(AppointmentStatus).optional(),
    reminderId: z.string().uuid().nullable().optional(),
    type: z.string().min(1).max(120).optional(),
    location: z.string().min(1).max(255).optional(),
    meetingUrl: z.string().url().optional().or(z.literal('')).nullable(),
    price: z.string().min(1).max(20).optional(),
    payed: z.boolean().optional(),
    duration: z.string().min(1).max(20).optional(),
    notes: z.string().max(500).optional(),
  })
  .refine(
    (d) => Object.keys(d).length > 0,
    { message: 'At least one field must be provided for update' }
  );

export const listAppointmentsSchema = z.object({
  patientId: z.string().uuid().optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  date: z.string().date().optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  payed: z.enum([ 'true', 'false' ]).transform(v => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  orderBy: z.enum([ 'date', 'createdAt', 'status', 'price' ]).default('date'),
  order: z.enum([ 'asc', 'desc' ]).default('asc'),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type CreateAppointmentDto = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentDto = z.infer<typeof updateAppointmentSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsSchema>;
