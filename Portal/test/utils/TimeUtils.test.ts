import { afterEach, describe, it, expect, vi } from "vitest";
import {
    fmtDate,
    fmtTime,
    fmtDateTime,
    fmtRelative,
    getDate,
    getDuration,
    getAppointmentEndTime,
    getTomorrowSixAm,
    getColombianHolidays,
    isoToLocal,
    getReminderSendAt,
    setDisplayTimezone,
    toWallClock,
    fromWallClock,
    fmtTimezoneLabel,
    getDisplayTimezone,
    browserTimezone,
    subscribeDisplayTimezone,
    getAge,
    calendarDayOf,
    calendarDayToIso,
    fmtCalendarDay,
    nextCalendarDay,
    localDateTimeToUtc,
} from "@/src/utils/TimeUtils";
import { AppointmentDuration } from "@/src/types/Appointment";
import { ReminderType } from "@/src/types/Reminder";

describe("fmtDate / fmtTime / fmtDateTime", () => {
    it("returns 'Invalid Date' for undefined input", () => {
        expect(fmtDate(undefined)).toBe("Invalid Date");
        expect(fmtTime(undefined)).toBe("Invalid Date");
        expect(fmtDateTime(undefined)).toBe("Invalid Date");
    });

});

describe("getDate", () => {
    it("slices only the date part", () => {
        expect(getDate("2024-06-15T10:30:00Z")).toBe("2024-06-15");
    });
});

describe("getDuration", () => {
    it("returns 60 min default when inputs are undefined", () => {
        expect(getDuration(undefined, undefined)).toBe(AppointmentDuration.MIN_60);
    });

    it("returns MIN_45 for a 45-minute diff", () => {
        const start = "2024-06-15T10:00:00Z";
        const end   = "2024-06-15T10:45:00Z";
        expect(getDuration(start, end)).toBe(AppointmentDuration.MIN_45);
    });

    it("returns MIN_90 for a 90-minute diff", () => {
        const start = "2024-06-15T10:00:00Z";
        const end   = "2024-06-15T11:30:00Z";
        expect(getDuration(start, end)).toBe(AppointmentDuration.MIN_90);
    });
});

describe("getAppointmentEndTime", () => {
    it("adds 60 minutes to the start", () => {
        const start = "2024-06-15T10:00:00.000Z";
        const end = getAppointmentEndTime(start, AppointmentDuration.MIN_60);
        expect(new Date(end).getTime() - new Date(start).getTime()).toBe(60 * 60 * 1000);
    });

    it("adds 45 minutes for MIN_45", () => {
        const start = "2024-06-15T10:00:00.000Z";
        const end = getAppointmentEndTime(start, AppointmentDuration.MIN_45);
        expect(new Date(end).getTime() - new Date(start).getTime()).toBe(45 * 60 * 1000);
    });
});

describe("getTomorrowSixAm", () => {
    it("returns an ISO string set to 6:00 AM local", () => {
        const result = getTomorrowSixAm();
        const date = new Date(result);
        expect(date.getHours()).toBe(6);
        expect(date.getMinutes()).toBe(0);
        expect(date.getSeconds()).toBe(0);
    });
});

describe("fmtRelative", () => {
    it("returns 'Invalid Date' for undefined", () => {
        expect(fmtRelative(undefined)).toBe("Invalid Date");
    });

    it("returns 'Ahora mismo' for now", () => {
        expect(fmtRelative(new Date().toISOString())).toBe("Ahora mismo");
    });
});

describe("isoToLocal", () => {
    it("returns a 16-char datetime-local string", () => {
        const result = isoToLocal("2024-06-15T10:00:00.000Z");
        expect(result).toHaveLength(16);
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });
});

describe("getColombianHolidays", () => {
    it("returns at least 18 holidays per year", () => {
        const holidays = getColombianHolidays(2024);
        expect(holidays.length).toBeGreaterThanOrEqual(18);
    });

    it("includes Navidad on Dec 25", () => {
        const holidays = getColombianHolidays(2024);
        const navidad = holidays.find(h => h.name === "Navidad");
        expect(navidad?.date).toBe("2024-12-25");
    });

    it("includes Año Nuevo on Jan 1", () => {
        const holidays = getColombianHolidays(2024);
        const newYear = holidays.find(h => h.name === "Año Nuevo");
        expect(newYear?.date).toBe("2024-01-01");
    });
});

describe("getReminderSendAt clock types use the given timezone", () => {
  // 2030-06-11 15:00 UTC = 10:00 in Bogota (UTC-5), 11:00 in New York (UTC-4)
  const start = "2030-06-11T15:00:00.000Z";

  it("same-day morning is 8:00 in the user's timezone", () => {
    expect(getReminderSendAt(start, ReminderType.SAME_DAY_MORNING, "America/Bogota")).toBe("2030-06-11T13:00:00.000Z");
    expect(getReminderSendAt(start, ReminderType.SAME_DAY_MORNING, "America/New_York")).toBe("2030-06-11T12:00:00.000Z");
  });

  it("previous-day evening is 18:00 the day before in the user's timezone", () => {
    expect(getReminderSendAt(start, ReminderType.PREVIOUS_DAY_EVENING, "America/Bogota")).toBe("2030-06-10T23:00:00.000Z");
  });

  it("uses the appointment's local date, not the UTC date", () => {
    // 2030-06-12 02:00 UTC is still June 11 at 21:00 in Bogota
    expect(getReminderSendAt("2030-06-12T02:00:00.000Z", ReminderType.SAME_DAY_MORNING, "America/Bogota")).toBe("2030-06-11T13:00:00.000Z");
  });
});

describe("display timezone (provider's, not the browser's)", () => {
    afterEach(() => setDisplayTimezone(undefined));

    it("formats instants in the display timezone", () => {
        setDisplayTimezone("America/Bogota");
        // 00:30Z on the 19th is still the 18th, 19:30 in Bogotá.
        expect(fmtDate("2026-10-19T00:30:00.000Z")).toBe(fmtDate("2026-10-18T12:00:00.000Z", "UTC"));
        expect(fmtTime("2026-10-19T00:30:00.000Z")).toBe(fmtTime("2026-10-18T19:30:00.000Z", "UTC"));
    });

    it("an explicit timezone overrides the display timezone", () => {
        setDisplayTimezone("America/Bogota");
        // 00:30 in UTC is what 05:30Z reads as in Bogotá.
        expect(fmtTime("2026-10-19T00:30:00.000Z", "UTC")).toBe(fmtTime("2026-10-19T05:30:00.000Z"));
    });

    it("treats date-only values as calendar days, never shifting them", () => {
        setDisplayTimezone("America/Bogota");
        expect(fmtDate("1990-05-01")).toBe(fmtDate("1990-05-01T12:00:00.000Z", "UTC"));
        setDisplayTimezone("Asia/Tokyo");
        expect(fmtDate("1990-05-01")).toBe(fmtDate("1990-05-01T12:00:00.000Z", "UTC"));
    });

    it("round-trips picker wall-clock values through the display timezone", () => {
        setDisplayTimezone("America/Bogota");
        expect(toWallClock("2026-10-19T14:05:00.000Z")).toBe("2026-10-19T09:05:00");
        expect(fromWallClock("2026-10-19T09:05:00")).toBe("2026-10-19T14:05:00.000Z");
        expect(fromWallClock("2026-10-19T09:05")).toBe("2026-10-19T14:05:00.000Z");
        expect(toWallClock("2026-10-19")).toBe("2026-10-19T00:00:00");
        expect(isoToLocal("2026-10-19T14:05:00.000Z")).toBe("2026-10-19T09:05");
    });

    it("getTomorrowSixAm is 06:00 tomorrow in the display timezone", () => {
        setDisplayTimezone("America/Bogota");
        const iso = getTomorrowSixAm();
        expect(toWallClock(iso).slice(11)).toBe("06:00:00");
    });

    it("labels the timezone with its offset", () => {
        expect(fmtTimezoneLabel("America/Bogota")).toBe("Bogota (GMT-5)");
    });
});

describe("display timezone store", () => {
    afterEach(() => {
        setDisplayTimezone(undefined);
        vi.useRealTimers();
    });

    it("falls back to the browser zone for an invalid timezone and reports it", () => {
        const onInvalid = vi.fn();
        setDisplayTimezone("Bogota", onInvalid);
        expect(onInvalid).toHaveBeenCalledWith("Bogota");
        expect(getDisplayTimezone()).toBe(browserTimezone());
        // Formatting keeps working instead of throwing RangeError.
        expect(() => fmtDateTime("2026-10-19T00:30:00.000Z")).not.toThrow();
    });

    it("notifies subscribers only when the timezone changes", () => {
        const listener = vi.fn();
        const unsubscribe = subscribeDisplayTimezone(listener);
        setDisplayTimezone("America/Bogota");
        setDisplayTimezone("America/Bogota");
        setDisplayTimezone("Europe/Madrid");
        unsubscribe();
        setDisplayTimezone("UTC");
        expect(listener).toHaveBeenCalledTimes(2);
    });
});

describe("calendar days", () => {
    afterEach(() => vi.useRealTimers());

    it("stores a day as UTC midnight and reads it back without a timezone", () => {
        expect(calendarDayToIso("1990-05-01")).toBe("1990-05-01T00:00:00.000Z");
        expect(calendarDayOf("1990-05-01T00:00:00.000Z")).toBe("1990-05-01");
        expect(calendarDayOf("1990-05-01")).toBe("1990-05-01");
        expect(calendarDayOf("not a date")).toBeNull();
        expect(calendarDayOf(undefined)).toBeNull();
        expect(fmtCalendarDay("1990-05-01T00:00:00.000Z")).toBe(fmtDate("1990-05-01T12:00:00.000Z", "UTC"));
        expect(nextCalendarDay("2026-12-31")).toBe("2027-01-01");
    });

    it("computes age on the provider's today, independent of the browser zone", () => {
        // 2026-04-30T20:00Z is already May 1 in Tokyo but still April 30 in Bogotá.
        vi.useFakeTimers({ now: new Date("2026-04-30T20:00:00.000Z") });
        expect(getAge("1990-05-01T00:00:00.000Z", "Asia/Tokyo")).toBe(36);
        expect(getAge("1990-05-01T00:00:00.000Z", "America/Bogota")).toBe(35);
        expect(getAge(null)).toBeNull();
    });
});

describe("localDateTimeToUtc", () => {
    it("handles DST in the target zone", () => {
        expect(localDateTimeToUtc("2026-07-01", "09:00:00", "America/New_York")).toBe("2026-07-01T13:00:00.000Z");
        expect(localDateTimeToUtc("2026-01-15", "09:00:00", "America/New_York")).toBe("2026-01-15T14:00:00.000Z");
        expect(localDateTimeToUtc("2026-10-19", "00:00:00.000", "America/Bogota")).toBe("2026-10-19T05:00:00.000Z");
    });
});
