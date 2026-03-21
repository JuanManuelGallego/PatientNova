import { z } from 'zod';
import { Channel } from '../utils/types.js';
import { ReminderMode, ReminderStatus } from '@prisma/client';

// this will break with emails
const e164 = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Must be E.164 format, e.g. +15551234567');

const futureDate = z.coerce.date().min(new Date(), {
  message: "Event datetime must be in the future",
})

const contentVariablesSchema = z
  .record(z.string(), z.string())
  .optional();

export const createReminderSchema = z
  .object({
    channel: z.nativeEnum(Channel),
    to: e164,
    sendMode: z.nativeEnum(ReminderMode),
    contentSid: z.string().optional(),
    contentVariables: contentVariablesSchema,
    sendAt: futureDate,
    status: z.nativeEnum(ReminderStatus).optional().default(ReminderStatus.PENDING),
    messageId: z.string().optional(),
    patientId: z.string().uuid(),
    appointmentId: z.string().uuid().optional(),
  })
  .refine(
    (d) => d.sendMode === ReminderMode.IMMEDIATE || !!d.sendAt,
    { message: 'sendAt is required when sendMode is SCHEDULED', path: [ 'sendAt' ] }
  );

export const updateReminderSchema = z
  .object({
    channel: z.nativeEnum(Channel).optional(),
    contentVariables: contentVariablesSchema,
    contentSid: z.string().nullish().optional(),
    status: z.nativeEnum(ReminderStatus).optional(),
    error: z.string().max(1000).optional(),
    sendMode: z.nativeEnum(ReminderMode).optional(),
    sendAt: futureDate.optional(),
    messageId: z.string().optional(),
  })
  .refine(
    (d) => Object.keys(d).length > 0,
    { message: 'At least one field must be provided' }
  );

export const listRemindersSchema = z.object({
  status: z.union([
    z.nativeEnum(ReminderStatus),
    z.array(z.nativeEnum(ReminderStatus))
  ]).optional(),
  search: z.string().optional(),
  patientId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  orderBy: z.enum([ 'sendAt', 'createdAt', 'status' ]).default('sendAt'),
  order: z.enum([ 'asc', 'desc' ]).default('desc'),
});

export const reminderStatsSchema = z.object({
  patientId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});


export const uuidParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type CreateReminderDto = z.infer<typeof createReminderSchema>;
export type UpdateReminderDto = z.infer<typeof updateReminderSchema>;
export type ListRemindersQuery = z.infer<typeof listRemindersSchema>;
export type ReminderStatsQuery = z.infer<typeof reminderStatsSchema>;
