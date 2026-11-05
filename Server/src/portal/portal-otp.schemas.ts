import { z } from 'zod';
import { Channel } from '../../generated/prisma/enums.js';
import { e164Regex } from '../utils/validation/middleware.js';

const portalEmail = z.string().trim().toLowerCase().max(254).pipe(z.email('Must be a valid email address'));
const portalPhone = z.string().trim().regex(e164Regex, 'Phone must be E.164 format (e.g. +573001234567)');
const captchaToken = z.string().max(2048).optional();

const verifyFields = {
  code: z.string().trim().regex(/^\d{6}$/, 'Code must be 6 digits'),
  challenge: z.string().regex(/^[A-Za-z0-9_-]{32}$/, 'Invalid challenge'),
};

export const requestOtpSchema = z.union([
  z.strictObject({ email: portalEmail, captchaToken }),
  z.strictObject({ phone: portalPhone, channel: z.literal(Channel.WHATSAPP), captchaToken }),
]);

export const verifyOtpSchema = z.union([
  z.strictObject({ email: portalEmail, ...verifyFields }),
  z.strictObject({ phone: portalPhone, ...verifyFields }),
]);

export type RequestOtpBody = z.infer<typeof requestOtpSchema>;
export type VerifyOtpBody = z.infer<typeof verifyOtpSchema>;
