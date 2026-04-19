import { z } from 'zod';
import { Channel } from '@prisma/client';


const e164 = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164 format (e.g. +15551234567)');

const futureIso = z
  .string()
  .datetime({ message: 'Must be a valid ISO-8601 datetime string' })
  .refine(v => new Date(v) > new Date(), { message: 'sentAt must be in the future' });

export const sendWhatsAppSchema = z
  .object({
    to: e164,
    contentSid: z.string().startsWith('HX'),
    contentVariables: z.record(z.string())
      .refine(
        (obj) => Object.keys(obj).length <= 10 && JSON.stringify(obj).length <= 1000,
        'Content variables too large (max 10 keys, 1000 characters total)'
      )
      .optional(),
    patientId: z.string().uuid().optional(),
  });

export const sendSmsSchema = z.object({
  to: e164,
  body: z.string().min(1, 'body cannot be empty'),
});

export const scheduleSchema = z.object({
  channel: z.nativeEnum(Channel),
  payload: z.union([ sendWhatsAppSchema, sendSmsSchema ]),
  sentAt: futureIso,
});
