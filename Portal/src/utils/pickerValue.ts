import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { fromWallClock, getDisplayTimezone, toWallClock } from "@/src/utils/TimeUtils";

dayjs.extend(utc);
dayjs.extend(customParseFormat);

/*
 * Pickers hold the provider's wall-clock time as a UTC-mode dayjs: UTC has no DST, so every wall time exists
 * (a browser-local dayjs silently moves a time in the device zone's DST gap, e.g. 02:30 on a spring-forward
 * day becomes 03:30). The UTC instant is only computed at the edges (`toPickerValue` / `fromPickerValue`)
 * in the provider's zone.
 */

/** The current wall-clock time in `timezone` (display zone if omitted), as a picker value. */
export function nowInZone(timezone: string = getDisplayTimezone()): Dayjs {
    return dayjs.utc(toWallClock(new Date(), timezone));
}

/** A stored value (UTC instant, or "YYYY-MM-DD" day) as a picker value showing its wall clock in `timezone`. */
export function toPickerValue(value: string, timezone: string = getDisplayTimezone()): Dayjs {
    return dayjs.utc(toWallClock(value, timezone));
}

/** A picker value back to a UTC ISO instant, reading its wall clock in `timezone`. */
export function fromPickerValue(value: Dayjs, timezone: string = getDisplayTimezone()): string {
    return fromWallClock(value.format("YYYY-MM-DDTHH:mm:ss"), timezone);
}
