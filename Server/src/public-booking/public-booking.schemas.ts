import { z } from 'zod';
import { DateTime } from 'luxon';

const MAX_SLOT_RANGE_DAYS = 31;
const RANGE_MESSAGE = 'Rango de fechas inválido';

const dayOf = (d: string) => DateTime.fromISO(d, { zone: 'UTC' });

const calendarDate = z.string().refine((d) => dayOf(d).toISODate() === d, { message: RANGE_MESSAGE });

const withinRange = (q: { from: string; to: string }) => {
  const days = dayOf(q.to).diff(dayOf(q.from), 'days').days;
  return days >= 0 && days < MAX_SLOT_RANGE_DAYS;
};

/** Local calendar days (provider zone), at most 31. */
export const slotRangeQuerySchema = z
  .strictObject({ from: calendarDate, to: calendarDate })
  .refine(withinRange, { message: RANGE_MESSAGE });

export type SlotRangeQuery = z.infer<typeof slotRangeQuerySchema>;

export const slotsQuerySchema = z
  .object({
    typeId: z.uuid(),
    from: calendarDate,
    to: calendarDate,
  })
  .refine(withinRange, { message: RANGE_MESSAGE });

export type SlotsQuery = z.infer<typeof slotsQuerySchema>;
