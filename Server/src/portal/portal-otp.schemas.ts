import { z } from 'zod';

const portalEmail = z.string().trim().toLowerCase().max(254).pipe(z.email('Must be a valid email address'));

export const requestOtpSchema = z.strictObject({
  email: portalEmail,
  // Checked by requireCaptcha; declared here so the strict schema accepts it.
  captchaToken: z.string().max(2048).optional(),
});

export const verifyOtpSchema = z.strictObject({
  email: portalEmail,
  code: z.string().trim().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export type RequestOtpBody = z.infer<typeof requestOtpSchema>;
export type VerifyOtpBody = z.infer<typeof verifyOtpSchema>;
