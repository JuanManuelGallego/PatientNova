import { z } from 'zod';
import { isReservedSlug, isValidSlugFormat, SLUG_MAX_LENGTH, SLUG_MIN_LENGTH } from './slug.js';

export const SLOT_INTERVAL_OPTIONS = [ 5, 10, 15, 20, 30, 45, 60, 90, 120 ] as const;
export const MAX_AVAILABILITY_RULES = 50;
const MINUTES_PER_DAY = 1440;
const MINUTE_STEP = 5;

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
    slotIntervalMinutes: z.number().int().refine(
      (n) => (SLOT_INTERVAL_OPTIONS as readonly number[]).includes(n),
      { message: `slotIntervalMinutes must be one of ${SLOT_INTERVAL_OPTIONS.join(', ')}` },
    ).optional(),
    bufferMinutes: z.number().int().min(0).max(240).optional(),
    minLeadMinutes: z.number().int().min(0).max(14 * 24 * 60).optional(),
    maxHorizonDays: z.number().int().min(1).max(365).optional(),
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
