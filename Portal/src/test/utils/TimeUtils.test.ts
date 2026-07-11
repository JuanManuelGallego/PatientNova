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
} from "../../utils/TimeUtils";
import { AppointmentDuration } from "../../types/Appointment";

describe("fmtDate / fmtTime / fmtDateTime", () => {
    it("returns 'Invalid Date' for undefined input", () => {
        expect(fmtDate(undefined)).toBe("Invalid Date");
        expect(fmtTime(undefined)).toBe("Invalid Date");
        expect(fmtDateTime(undefined)).toBe("Invalid Date");
    });

    it("formats a known ISO date (locale-agnostic length check)", () => {
        const result = fmtDate("2024-06-15T00:00:00Z");
        expect(result.length).toBeGreaterThan(5);
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

    it("is in the future", () => {
        expect(new Date(getTomorrowSixAm()).getTime()).toBeGreaterThan(Date.now());
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
