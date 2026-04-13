export function getLocalTimeParts(timezone: string, date: Date = new Date()): { year: number; month: number; day: number; hour: number; minute: number } {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(date);
    const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? "0");
    return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** Converts a local calendar date+time in a given IANA timezone to a UTC Date. */
export function localToUtc(year: number, month: number, day: number, hour: number, minute: number, second: number, timezone: string): Date {
    const pad = (n: number, w = 2) => String(n).padStart(w, "0");
    // Treat the desired local time as if it were UTC to get a reference point
    const refDate = new Date(`${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}Z`);
    // Format that reference UTC as local time in the target timezone
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).formatToParts(refDate);
    const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? "0");
    const localMs = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    // Derive actual UTC: refDate - (localMs - refDate) = 2*refDate - localMs
    return new Date(2 * refDate.getTime() - localMs);
}

/** Returns the UTC start (00:00:00) and end (23:59:59) of tomorrow in the given IANA timezone. */
export function getTomorrowUTCRange(timezone: string): { start: Date; end: Date } {
    const { year, month, day } = getLocalTimeParts(timezone);
    // Date.UTC handles day-of-month overflow (e.g. April 31 → May 1)
    const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
    const ty = tomorrow.getUTCFullYear(), tm = tomorrow.getUTCMonth() + 1, td = tomorrow.getUTCDate();
    return {
        start: localToUtc(ty, tm, td, 0, 0, 0, timezone),
        end: localToUtc(ty, tm, td, 23, 59, 59, timezone),
    };
}
