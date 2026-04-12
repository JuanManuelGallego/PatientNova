import { AppointmentStatus } from '@prisma/client';
import { z } from 'zod';

export const createAppointmentSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  timezone: z.string().optional(),
  price: z.number(),
  currency: z.string().optional(),
  paid: z.boolean().default(false),
  meetingUrl: z.string().url('meetingUrl must be a valid URL').max(500).or(z.literal('')).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  status: z.nativeEnum(AppointmentStatus).default(AppointmentStatus.SCHEDULED),
  patientId: z.string().uuid('patientId must be a valid UUID'),
  reminderId: z.string().uuid('reminderId must be a valid UUID').nullable().optional(),
  locationId: z.string().uuid('locationId must be a valid UUID'),
  typeId: z.string().uuid('typeId must be a valid UUID'),
});

export const updateAppointmentSchema = z
  .object({
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    timezone: z.string().optional(),
    price: z.number().optional(),
    currency: z.string().optional(),
    paid: z.boolean().optional(),
    meetingUrl: z.string().url('meetingUrl must be a valid URL').max(500).optional().or(z.literal('')),
    notes: z.string().max(500).optional(),
    typeId: z.string().uuid('typeId must be a valid UUID').optional(),
    status: z.nativeEnum(AppointmentStatus).default(AppointmentStatus.SCHEDULED).optional(),
    reminderId: z.string().uuid('reminderId must be a valid UUID').nullable().optional(),
    locationId: z.string().uuid('locationId must be a valid UUID').optional(),
  })
  .refine(
    (d) => Object.keys(d).length > 0,
    { message: 'At least one valid field must be provided for update' }
  );

export const listAppointmentsSchema = z.object({
  patientId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  typeId: z.string().uuid().optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  startAt: z.string().datetime().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().optional(),
  paid: z.enum([ 'true', 'false' ]).transform(v => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  orderBy: z.enum([ 'startAt', 'createdAt', 'status', 'price', 'locationId', 'typeId', 'patientName' ]).default('startAt'),
  order: z.enum([ 'asc', 'desc' ]).default('asc'),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export const appointmentStatsSchema = z.object({
  patientId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export type CreateAppointmentDto = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentDto = z.infer<typeof updateAppointmentSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsSchema>;
export type AppointmentStatsQuery = z.infer<typeof appointmentStatsSchema>;
