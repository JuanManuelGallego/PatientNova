import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from './types.js';


const e164 = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164 format (e.g. +15551234567)');

const futureIso = z
  .string()
  .datetime({ message: 'Must be a valid ISO-8601 datetime string' })
  .refine(v => new Date(v) > new Date(), { message: 'sendAt must be in the future' });

export const sendWhatsAppSchema = z
  .object({
    to: e164,
    contentSid: z.string().startsWith('HX'),
    contentVariables: z.record(z.string()).optional(),
  });

export const sendSmsSchema = z.object({
  to: e164,
  body: z.string().min(1, 'body cannot be empty'),
});

export const scheduleSchema = z.object({
  channel: z.enum([ 'whatsapp', 'sms' ]),
  payload: z.union([ sendWhatsAppSchema, sendSmsSchema ]),
  sendAt: futureIso,
});

export function validate<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const response: ApiResponse = {
        success: false,
        error: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
        timestamp: new Date().toISOString(),
      };
      res.status(400).json(response);
      return;
    }
    req.body = result.data;
    next();
  };
}
