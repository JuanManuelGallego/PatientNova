import { z } from 'zod';
import { Channel } from '../utils/types.js';
import { ReminderMode, ReminderStatus } from '@prisma/client';

const e164 = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Must be E.164 format, e.g. +15551234567');

const isoDate = z
  .string()
  .datetime({ message: 'Must be a valid ISO-8601 datetime string' });

const contentVariablesSchema = z
  .record(z.string(), z.string())
  .optional();

export const createReminderSchema = z
  .object({
    channel: z.nativeEnum(Channel),
    to: e164,
    mode: z.nativeEnum(ReminderMode),
    contentSid: z.string().max(100).optional(),
    contentVariables: contentVariablesSchema,
    sendAt: isoDate,
    scheduledAt: isoDate.optional(),
    status: z.nativeEnum(ReminderStatus).optional(),
    messageId: z.string().max(100).optional(),
    patientId: z.string().uuid().optional(),
  })
  .refine(
    (d) => d.mode === ReminderMode.IMMEDIATE || !!d.scheduledAt,
    { message: 'scheduledAt is required when mode is SCHEDULED', path: [ 'scheduledAt' ] }
  )
  .refine(
    (d) => new Date(d.sendAt) > new Date(),
    { message: 'sendAt must be in the future', path: [ 'sendAt' ] }
  );

export const updateReminderSchema = z
  .object({
    channel: z.nativeEnum(Channel).optional(),
    to: e164.optional(),
    status: z.nativeEnum(ReminderStatus).optional(),
    contentVariables: contentVariablesSchema,
    contentSid: z.string().max(100).optional(),
    mode: z.nativeEnum(ReminderMode).optional(),
    scheduledAt: isoDate.optional(),
    sendAt: isoDate.optional(),
    error: z.string().max(1000).optional(),
    messageId: z.string().max(100).optional(),
    patientId: z.string().uuid().optional(),
  })
  .refine(
    (d) => Object.keys(d).length > 0,
    { message: 'At least one field must be provided' }
  );

export const listRemindersSchema = z.object({
  status: z.nativeEnum(ReminderStatus).optional(),
  channel: z.nativeEnum(Channel).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  orderBy: z.enum([ 'sendAt', 'createdAt', 'status' ]).default('sendAt'),
  order: z.enum([ 'asc', 'desc' ]).default('asc'),
});


export const uuidParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export type CreateReminderDto = z.infer<typeof createReminderSchema>;
export type UpdateReminderDto = z.infer<typeof updateReminderSchema>;
export type ListRemindersQuery = z.infer<typeof listRemindersSchema>;
