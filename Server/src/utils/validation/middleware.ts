import { z } from 'zod';
import { Channel, ReminderMode } from '../../../generated/prisma/enums.js';
import { BULK_SEND_MAX_PATIENTS } from '../config/constants.js';

export const e164Regex = /^\+[1-9]\d{7,14}$/;

const e164 = z
  .string()
  .regex(e164Regex, 'Phone must be E.164 format (e.g. +15551234567)');

const futureIso = z
  .string()
  .datetime({ message: 'Must be a valid ISO-8601 datetime string' })
  .refine(v => new Date(v) > new Date(), { message: 'sentAt must be in the future' });

const contentVariablesRecord = z.record(z.string(), z.string()).refine(
  (obj) => Object.keys(obj).length <= 10 && JSON.stringify(obj).length <= 1000,
  { error: 'Content variables too large (max 10 keys, 1000 characters total)' }
);

export const sendWhatsAppSchema = z
  .object({
    to: e164,
    contentSid: z.string().startsWith('HX'),
    contentVariables: contentVariablesRecord.optional(),
    patientId: z.uuid().optional(),
  });

export const sendSmsSchema = z.object({
  to: e164,
  body: z.string().min(1, 'body cannot be empty'),
  patientId: z.uuid().optional(),
});

export const scheduleSchema = z.object({
  channel: z.enum(Channel),
  payload: z.union([ sendWhatsAppSchema, sendSmsSchema ]),
  sentAt: futureIso,
});

export const e164OrEmpty = z
  .string()
  .regex(e164Regex, 'Must be E.164 format (e.g. +15551234567)')
  .nullish()
  .or(z.literal(''));

export const strongPassword = z
  .string()
  .min(8, 'At least 8 characters')
  .refine(p => /[A-Z]/.test(p), 'At least one uppercase letter')
  .refine(p => /[a-z]/.test(p), 'At least one lowercase letter')
  .refine(p => /[0-9]/.test(p), 'At least one number')
  .refine(p => /[!@#$%^&*(),.?":{}|<>]/.test(p), 'At least one special character');

export const bulkSendSchema = z.object({
  channel: z.enum(Channel),
  templateKey: z.string().min(1),
  patientIds: z.array(z.uuid()).min(1).max(BULK_SEND_MAX_PATIENTS),
  sendMode: z.enum(ReminderMode),
  sendAt: futureIso.optional(),
  sharedVariables: contentVariablesRecord.optional(),
  // Raw message text for SMS with {{N}} placeholders; the server renders it
  // per patient (shared variables + patient name). WhatsApp uses templates.
  body: z.string().min(1, 'body cannot be empty').max(1600, 'body exceeds 1600 characters').optional(),
}).refine(
  (d) => d.sendMode === ReminderMode.IMMEDIATE || !!d.sendAt,
  { message: 'sendAt is required when sendMode is SCHEDULED', path: ['sendAt'] }
).refine(
  (d) => d.channel !== Channel.SMS || !!d.body,
  { message: 'body is required when channel is SMS', path: ['body'] }
);
