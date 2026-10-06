import { describe, it, expect } from "vitest";
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
