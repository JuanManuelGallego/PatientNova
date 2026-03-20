import { AppointmentStatus } from '@prisma/client';
import { z } from 'zod';

export enum ReminderType {
  NONE = "NINGUNO",
  ONE_HOUR_BEFORE = "1_HORA_ANTES",
  ONE_DAY_BEFORE = "1_DIA_ANTES",
  ONE_WEEK_BEFORE = "1_SEMANA_ANTES",
}

export const createAppointmentSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  timezone: z.string().optional(),
  price: z.number(),
  currency: z.string().optional(),
  paid: z.boolean().default(false),
  location: z.string().min(1, 'location is required').max(255),
  meetingUrl: z.string().url('meetingUrl must be a valid URL').max(500).optional().or(z.literal('')),
  notes: z.string().max(500).optional(),
  type: z.string().min(1, 'type is required').max(120),
  status: z.nativeEnum(AppointmentStatus).default(AppointmentStatus.SCHEDULED),
  patientId: z.string().uuid('patientId must be a valid UUID'),
  reminderId: z.string().uuid().nullable().optional(),
});

export const updateAppointmentSchema = z
  .object({
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    timezone: z.string().optional(),
    price: z.number().optional(),
    currency: z.string().optional(),
    paid: z.boolean().optional(),
    location: z.string().min(1, 'location is required').max(255).optional(),
    meetingUrl: z.string().url('meetingUrl must be a valid URL').max(500).optional().or(z.literal('')),
    notes: z.string().max(500).optional(),
    type: z.string().min(1, 'type is required').max(120).optional(),
    status: z.nativeEnum(AppointmentStatus).default(AppointmentStatus.SCHEDULED).optional(),
    cancelledAt: z.string().datetime().optional(),
    confirmedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
    reminderId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (d) => Object.keys(d).length > 0,
    { message: 'At least one field must be provided for update' }
  );

export const listAppointmentsSchema = z.object({
  patientId: z.string().uuid().optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  startAt: z.string().date().optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  location: z.string().optional(),
  paid: z.enum([ 'true', 'false' ]).transform(v => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  orderBy: z.enum([ 'startAt', 'createdAt', 'status', 'price' ]).default('startAt'),
  order: z.enum([ 'asc', 'desc' ]).default('asc'),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type CreateAppointmentDto = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentDto = z.infer<typeof updateAppointmentSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsSchema>;
