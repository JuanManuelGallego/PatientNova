import { AppointmentStatus } from '../../generated/prisma/client.ts';
import { z } from 'zod';
import { includeDeletedQuery } from '../utils/schemas.js';

function isValidIANATimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const timezoneSchema = z.string().max(50).optional().refine(
  tz => !tz || isValidIANATimezone(tz),
  { message: 'Invalid IANA timezone identifier' }
);

export const createAppointmentSchema = z.object({
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  timezone: timezoneSchema,
  price: z.number().min(0, 'Price must be non-negative'),
  currency: z.string().optional(),
  paid: z.boolean().default(false),
  meetingUrl: z.string().url('meetingUrl must be a valid URL').max(500).or(z.literal('')).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  status: z.enum(AppointmentStatus).default(AppointmentStatus.SCHEDULED),
  patientId: z.uuid('patientId must be a valid UUID'),
  reminderId: z.uuid('reminderId must be a valid UUID').nullable().optional(),
  locationId: z.uuid('locationId must be a valid UUID'),
  typeId: z.uuid('typeId must be a valid UUID'),
});

export const updateAppointmentSchema = z
  .object({
    startAt: z.iso.datetime().optional(),
    endAt: z.iso.datetime().optional(),
    timezone: timezoneSchema,
    price: z.number().min(0, 'Price must be non-negative').optional(),
    currency: z.string().optional(),
    paid: z.boolean().optional(),
    meetingUrl: z.string().url('meetingUrl must be a valid URL').max(500).optional().or(z.literal('')),
    notes: z.string().max(500).optional(),
    typeId: z.uuid('typeId must be a valid UUID').optional(),
    status: z.enum(AppointmentStatus).default(AppointmentStatus.SCHEDULED).optional(),
    reminderId: z.uuid('reminderId must be a valid UUID').nullable().optional(),
    locationId: z.uuid('locationId must be a valid UUID').optional(),
  })
  .refine(
    (d) => Object.keys(d).length > 0,
    { message: 'At least one valid field must be provided for update' }
  );

export const listAppointmentsSchema = z.object({
  patientId: z.uuid().optional(),
  locationId: z.uuid().optional(),
  typeId: z.uuid().optional(),
  status: z.union([
    z.enum(AppointmentStatus),
    z.array(z.enum(AppointmentStatus))
  ]).optional(),
  startAt: z.iso.datetime().optional(),
  dateFrom: z.iso.datetime().optional(),
  dateTo: z.iso.datetime().optional(),
  search: z.string().optional(),
  paid: z.enum([ 'true', 'false' ]).transform(v => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  orderBy: z.enum([ 'startAt', 'createdAt', 'status', 'price', 'locationId', 'typeId' ]).default('startAt'),
  order: z.enum([ 'asc', 'desc' ]).default('asc'),
}).extend(includeDeletedQuery.shape);

export const appointmentStatsSchema = z.object({
  patientId: z.uuid().optional(),
  dateFrom: z.iso.datetime().optional(),
  dateTo: z.iso.datetime().optional(),
}).extend(includeDeletedQuery.shape);

export type CreateAppointmentDto = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentDto = z.infer<typeof updateAppointmentSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsSchema>;
export type AppointmentStatsQuery = z.infer<typeof appointmentStatsSchema>;
