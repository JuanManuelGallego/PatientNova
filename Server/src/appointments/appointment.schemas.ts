import { AppointmentStatus, Channel, ReminderMode, ReminderStatus } from '../../generated/prisma/client.ts';
import { z } from 'zod';
import { includeDeletedQuery } from '../utils/schemas.js';
import { isValidIANATimezone } from '../utils/timeUtils.ts';

const timezoneSchema = z.string().max(50).optional().refine(
  tz => !tz || isValidIANATimezone(tz),
  { message: 'Invalid IANA timezone identifier' }
);

const reminderInlineSchema = z.object({
  channel: z.enum(Channel),
  to: z.string().min(1),
  sendMode: z.enum(ReminderMode),
  contentSid: z.string().optional(),
  contentVariables: z.record(z.string(), z.string()).optional(),
  sendAt: z.iso.datetime().optional(),
  status: z.enum(ReminderStatus).optional().default(ReminderStatus.PENDING),
  body: z.string().max(500).optional(),
}).refine(
  (d) => d.sendMode === ReminderMode.IMMEDIATE || !!d.sendAt,
  { message: 'sendAt is required when sendMode is SCHEDULED', path: ['sendAt'] }
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
  reminder: reminderInlineSchema.nullable().optional(),
}).refine(
  (d) => !(d.reminderId && d.reminder),
  { message: 'Cannot provide both reminderId and reminder', path: ['reminder'] }
).refine(
  (d) => new Date(d.endAt) > new Date(d.startAt),
  { message: 'endAt must be after startAt', path: ['endAt'] }
);

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
    status: z.enum(AppointmentStatus).optional(),
    reminderId: z.uuid('reminderId must be a valid UUID').nullable().optional(),
    locationId: z.uuid('locationId must be a valid UUID').optional(),
    reminder: reminderInlineSchema.nullable().optional(),
  })
  .refine(
    (d) => Object.keys(d).length > 0,
    { message: 'At least one valid field must be provided for update' }
  )
  .refine(
    (d) => !(d.reminderId && d.reminder),
    { message: 'Cannot provide both reminderId and reminder', path: ['reminder'] }
  )
  .refine(
    (d) => !d.startAt || !d.endAt || new Date(d.endAt) > new Date(d.startAt),
    { message: 'endAt must be after startAt', path: ['endAt'] }
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
