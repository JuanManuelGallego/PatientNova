import { z } from 'zod';
import { DateTime } from 'luxon';

const MAX_SLOT_RANGE_DAYS = 31;
const RANGE_MESSAGE = 'Rango de fechas inválido';

const dayOf = (d: string) => DateTime.fromISO(d, { zone: 'UTC' });

const calendarDate = z.string().refine((d) => dayOf(d).toISODate() === d, { message: RANGE_MESSAGE });

export const slotsQuerySchema = z
  .object({
    typeId: z.uuid(),
    from: calendarDate,
    to: calendarDate,
  })
  .refine((q) => {
    const days = dayOf(q.to).diff(dayOf(q.from), 'days').days;
    return days >= 0 && days < MAX_SLOT_RANGE_DAYS;
  }, { message: RANGE_MESSAGE });

export type SlotsQuery = z.infer<typeof slotsQuerySchema>;
