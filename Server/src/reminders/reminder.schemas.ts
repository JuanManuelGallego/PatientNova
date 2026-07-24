import { z } from 'zod';
import { Channel, ReminderMode, ReminderStatus } from '../../generated/prisma/client.ts';
import { includeDeletedQuery } from '../utils/validation/schemas.js';
import { e164Regex } from '../utils/validation/middleware.ts';

// this will break with emails
const e164 = z
  .string()
  .regex(e164Regex, 'Must be E.164 format, e.g. +15551234567');

const futureDate = z.coerce.date().min(new Date(), {
  message: "Event datetime must be in the future",
})

const contentVariablesSchema = z
  .record(z.string(), z.string())
  .optional();

export const createReminderSchema = z
  .object({
    channel: z.enum(Channel),
    to: e164,
    sendMode: z.enum(ReminderMode),
    contentSid: z.string().optional(),
    contentVariables: contentVariablesSchema,
    sendAt: futureDate,
    status: z.enum(ReminderStatus).optional().default(ReminderStatus.PENDING),
    messageId: z.string().optional(),
    patientId: z.uuid(),
    appointmentId: z.uuid().optional(),
    body: z.string().max(1000).optional(),
  })
  .refine(
    (d) => d.sendMode === ReminderMode.IMMEDIATE || !!d.sendAt,
    { message: 'sendAt is required when sendMode is SCHEDULED', path: [ 'sendAt' ] }
  );

export const updateReminderSchema = z
  .object({
    channel: z.enum(Channel).optional(),
    contentVariables: contentVariablesSchema,
    contentSid: z.string().nullish().optional(),
    status: z.enum(ReminderStatus).optional(),
    error: z.string().max(1000).optional(),
    sendMode: z.enum(ReminderMode).optional(),
    sendAt: futureDate.optional(),
    messageId: z.string().optional(),
    body: z.string().max(1000).optional(),
  })
  .refine(
    (d) => Object.keys(d).length > 0,
    { message: 'At least one field must be provided' }
  );

export const listRemindersSchema = z.object({
  status: z.union([
    z.enum(ReminderStatus),
    z.array(z.enum(ReminderStatus))
  ]).optional(),
  search: z.string().optional(),
  patientId: z.uuid().optional(),
  dateFrom: z.iso.datetime().optional(),
  dateTo: z.iso.datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  orderBy: z.enum([ 'sendAt', 'createdAt', 'status', 'updatedAt' ]).default('sendAt'),
  order: z.enum([ 'asc', 'desc' ]).default('desc'),
}).extend(includeDeletedQuery.shape);

export const reminderStatsSchema = z.object({
  patientId: z.uuid().optional(),
  dateFrom: z.iso.datetime().optional(),
  dateTo: z.iso.datetime().optional(),
}).extend(includeDeletedQuery.shape);

export type CreateReminderDto = z.infer<typeof createReminderSchema>;
export type UpdateReminderDto = z.infer<typeof updateReminderSchema>;
export type ListRemindersQuery = z.infer<typeof listRemindersSchema>;
export type ReminderStatsQuery = z.infer<typeof reminderStatsSchema>;
