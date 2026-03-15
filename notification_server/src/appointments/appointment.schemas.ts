import { AppointmentStatus } from '@prisma/client';
import { z } from 'zod';

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format');

const timeStr = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM format');

export const createAppointmentSchema = z.object({
  patientId:  z.string().uuid('patientId must be a valid UUID'),
  date:       dateStr,
  time:       timeStr,
  status:     z.nativeEnum(AppointmentStatus).default(AppointmentStatus.SCHEDULED),
  reminderId: z.string().uuid('reminderId must be a valid UUID').optional(),
  type:       z.string().min(1, 'type is required').max(120),
  location:   z.string().min(1, 'location is required').max(255),
  meetingUrl: z.string().url('meetingUrl must be a valid URL').optional().or(z.literal('')),
  price:      z.string().min(1, 'price is required').max(20),
  payed:      z.boolean().default(false),
  duration:   z.string().min(1, 'duration is required').max(20),
});

export const updateAppointmentSchema = z
  .object({
    patientId:  z.string().uuid().optional(),
    date:       dateStr.optional(),
    time:       timeStr.optional(),
    status:     z.nativeEnum(AppointmentStatus).optional(),
    reminderId: z.string().uuid().nullable().optional(),
    type:       z.string().min(1).max(120).optional(),
    location:   z.string().min(1).max(255).optional(),
    meetingUrl: z.string().url().optional().or(z.literal('')).nullable(),
    price:      z.string().min(1).max(20).optional(),
    payed:      z.boolean().optional(),
    duration:   z.string().min(1).max(20).optional(),
  })
  .refine(
    (d) => Object.keys(d).length > 0,
    { message: 'At least one field must be provided for update' }
  );

export const listAppointmentsSchema = z.object({
  patientId:  z.string().uuid().optional(),
  status:     z.nativeEnum(AppointmentStatus).optional(),
  date:       dateStr.optional(),
  dateFrom:   dateStr.optional(),
  dateTo:     dateStr.optional(),
  payed:      z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  page:       z.coerce.number().int().min(1).default(1),
  pageSize:   z.coerce.number().int().min(1).max(100).default(20),
  orderBy:    z.enum(['date', 'createdAt', 'status', 'price']).default('date'),
  order:      z.enum(['asc', 'desc']).default('asc'),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type CreateAppointmentDto  = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentDto  = z.infer<typeof updateAppointmentSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsSchema>;
