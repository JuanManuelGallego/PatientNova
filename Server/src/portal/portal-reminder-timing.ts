import { PortalReminderTiming } from '../../generated/prisma/enums.js';
import { ONE_DAY_MS, ONE_HOUR_MS } from '../utils/config/constants.js';
import { getLocalDateString, localToUtc } from '../utils/time/time-utils.js';

type Preset = { offsetMs: number } | { clock: { daysBefore: number; hour: number; minute: number } };

/**
 * The appointment modal's reminder presets (`REMINDER_TYPE_CONFIG` in `Portal/src/types/Reminder.ts`, computed by
 * `getReminderSendAt` in `Portal/src/utils/TimeUtils.ts`): keep both in step.
 */
const PRESETS: Record<Exclude<PortalReminderTiming, 'NONE'>, Preset> = {
  [PortalReminderTiming.ONE_HOUR_BEFORE]: { offsetMs: ONE_HOUR_MS },
  [PortalReminderTiming.ONE_DAY_BEFORE]: { offsetMs: ONE_DAY_MS },
  [PortalReminderTiming.SAME_DAY_MORNING]: { clock: { daysBefore: 0, hour: 8, minute: 0 } },
  [PortalReminderTiming.PREVIOUS_DAY_MORNING]: { clock: { daysBefore: 1, hour: 9, minute: 0 } },
  [PortalReminderTiming.PREVIOUS_DAY_EVENING]: { clock: { daysBefore: 1, hour: 18, minute: 0 } },
};

/**
 * When the reminder of an appointment starting at `start` goes out, or null for `NONE`. Clock presets are
 * wall-clock times on the appointment's local date in `timezone` (the patient's), DST-resolved by `localToUtc`.
 */
export function portalReminderSendAt(start: Date, timing: PortalReminderTiming, timezone: string): Date | null {
  if (timing === PortalReminderTiming.NONE) return null;
  const preset = PRESETS[timing];
  if ('offsetMs' in preset) return new Date(start.getTime() - preset.offsetMs);
  const { daysBefore, hour, minute } = preset.clock;
  const [ year, month, day ] = getLocalDateString(timezone, start, -daysBefore).split('-').map(Number) as [ number, number, number ];
  return localToUtc(year, month, day, hour, minute, 0, timezone);
}
