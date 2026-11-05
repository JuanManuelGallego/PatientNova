import { z } from 'zod';
import { BookingApprovalMode } from '../../generated/prisma/client.ts';
import { isReservedSlug, isValidSlugFormat, SLUG_MAX_LENGTH, SLUG_MIN_LENGTH } from './slug.js';
import { e164Regex } from '../utils/validation/middleware.js';

export const SLOT_INTERVAL_OPTIONS = [ 5, 10, 15, 20, 30, 45, 60, 90, 120 ] as const;
export const MAX_AVAILABILITY_RULES = 50;
export const MAX_PATIENT_RESCHEDULES = 10;
export const MAX_RESCHEDULE_NOTICE_HOURS = 7 * 24;
const MINUTES_PER_DAY = 1440;
const MINUTE_STEP = 5;
export const MAX_BIO_LENGTH = 600;
export const MAX_SPECIALTY_LENGTH = 120;
export const MAX_LICENSE_LENGTH = 60;

/** Optional public text: blank clears the stored value. */
const publicText = (max: number) => z.string().trim().max(max).transform((v) => v || null).nullable().optional();
const publicPhone = z.string().trim().regex(e164Regex).or(z.literal('')).transform((v) => v || null).nullable().optional();

export const bookingSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(SLUG_MIN_LENGTH)
  .max(SLUG_MAX_LENGTH)
  .refine(isValidSlugFormat, { message: 'slug may only contain lowercase letters, digits and single hyphens' })
  .refine((s) => !isReservedSlug(s), { message: 'slug is reserved' });

export const updateBookingSettingsSchema = z
  .object({
    bookingSlug: bookingSlugSchema.nullable().optional(),
    bookingEnabled: z.boolean().optional(),
    bookingApprovalMode: z.enum(BookingApprovalMode).optional(),
    slotIntervalMinutes: z.number().int().refine(
      (n) => (SLOT_INTERVAL_OPTIONS as readonly number[]).includes(n),
      { message: `slotIntervalMinutes must be one of ${SLOT_INTERVAL_OPTIONS.join(', ')}` },
    ).optional(),
    bufferMinutes: z.number().int().min(0).max(240).optional(),
    minLeadMinutes: z.number().int().min(0).max(14 * 24 * 60).optional(),
    maxHorizonDays: z.number().int().min(1).max(365).optional(),
    maxPatientReschedules: z.number().int().min(0).max(MAX_PATIENT_RESCHEDULES).optional(),
    minRescheduleNoticeHours: z.number().int().min(0).max(MAX_RESCHEDULE_NOTICE_HOURS).optional(),
    bio: publicText(MAX_BIO_LENGTH),
    specialty: publicText(MAX_SPECIALTY_LENGTH),
    professionalLicense: publicText(MAX_LICENSE_LENGTH),
    publicPhone,
    publicWhatsapp: publicPhone,
  })
  .refine(
    (d) => Object.keys(d).length > 0,
    { message: 'At least one field must be provided for update' },
  );

const minuteOfDay = z.number().int().min(0).max(MINUTES_PER_DAY).multipleOf(MINUTE_STEP);

export const availabilityRuleSchema = z
  .object({
    weekday: z.number().int().min(1).max(7),
    startMinute: minuteOfDay,
    endMinute: minuteOfDay,
  })
  .refine((r) => r.endMinute > r.startMinute, { message: 'endMinute must be after startMinute', path: [ 'endMinute' ] });

export const replaceAvailabilitySchema = z
  .object({
    rules: z.array(availabilityRuleSchema).max(MAX_AVAILABILITY_RULES),
  })
  .superRefine((d, ctx) => {
    // Half-open windows: touching ([9:00,12:00) + [12:00,14:00)) is fine, overlapping is not.
    const sorted = d.rules
      .map((r, index) => ({ ...r, index }))
      .sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      if (cur.weekday === prev.weekday && cur.startMinute < prev.endMinute) {
        ctx.addIssue({
          code: 'custom',
          message: 'availability windows overlap on the same weekday',
          path: [ 'rules', cur.index ],
        });
      }
    }
  });

export type UpdateBookingSettingsDto = z.infer<typeof updateBookingSettingsSchema>;
export type AvailabilityRuleDto = z.infer<typeof availabilityRuleSchema>;
export type ReplaceAvailabilityDto = z.infer<typeof replaceAvailabilitySchema>;
