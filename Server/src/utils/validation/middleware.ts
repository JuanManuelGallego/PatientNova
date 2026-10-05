import { z } from 'zod';
import { Channel, ReminderMode } from '../../../generated/prisma/enums.js';
import { BULK_SEND_MAX_PATIENTS } from '../config/constants.js';

export const e164Regex = /^\+[1-9]\d{7,14}$/;

// Pragmatic email check (mirrors zod's z.email() default pattern closely enough for recipients).
export const emailRegex = /^(?!\.)(?!.*\.\.)[A-Za-z0-9_'+\-.]*[A-Za-z0-9_+-]@[A-Za-z0-9][A-Za-z0-9-]*(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

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

export const sendEmailSchema = z.object({
  to: z.email('Must be a valid email address').max(255),
  subject: z.string().max(255).optional(),
  body: z.string().min(1, 'body cannot be empty'),
  patientId: z.uuid().optional(),
});

export const scheduleSchema = z.object({
  channel: z.enum(Channel),
  payload: z.union([ sendWhatsAppSchema, sendSmsSchema, sendEmailSchema ]),
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
  templateKey: z.string().min(1),
  patientIds: z.array(z.uuid()).min(1).max(BULK_SEND_MAX_PATIENTS),
  sendMode: z.enum(ReminderMode),
  sendAt: futureIso.optional(),
  sharedVariables: contentVariablesRecord.optional(),
  // Raw message text with {{N}} placeholders. Each patient receives the message on
  // their own reminderChannel: SMS/EMAIL patients get this body rendered per patient
  // (shared variables + patient name); WhatsApp patients get the Content template.
  body: z.string().min(1, 'body cannot be empty').max(1600, 'body exceeds 1600 characters'),
  // EMAIL only; falls back to DEFAULT_EMAIL_SUBJECT when omitted.
  subject: z.string().max(255).optional(),
}).refine(
  (d) => d.sendMode === ReminderMode.IMMEDIATE || !!d.sendAt,
  { message: 'sendAt is required when sendMode is SCHEDULED', path: ['sendAt'] }
);
