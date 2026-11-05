import { describe, expect, it } from "vitest";
import {
    addCalendarDays, calendarDaysBetween, lastBookableDateIn, slotQueryRange, fmtCop, fmtDayParts, fmtLongDay, fmtWeekRange, groupSlotsByDay,
    isE164, localDayOf, normalizePhone, weekPage,
} from "@/src/utils/publicBooking";

const slot = (startUtc: string) => ({ startUtc, endUtc: startUtc });
const starts = (slots: { startUtc: string }[]) => slots.map((s) => s.startUtc);

describe("groupSlotsByDay", () => {
    it("groups by the provider's local date and splits at local noon (Bogota)", () => {
        const days = groupSlotsByDay([
            slot("2026-11-09T13:00:00.000Z"),
            slot("2026-11-09T17:00:00.000Z"),
            slot("2026-11-10T04:30:00.000Z"),
            slot("2026-11-10T14:00:00.000Z"),
        ], "America/Bogota");
        expect(days.map((d) => d.date)).toEqual([ "2026-11-09", "2026-11-10" ]);
        expect(starts(days[ 0 ]!.morning)).toEqual([ "2026-11-09T13:00:00.000Z" ]);
        expect(starts(days[ 0 ]!.afternoon)).toEqual([ "2026-11-09T17:00:00.000Z", "2026-11-10T04:30:00.000Z" ]);
        expect(starts(days[ 1 ]!.morning)).toEqual([ "2026-11-10T14:00:00.000Z" ]);
    });

    it("uses each instant's own offset across DST changes (New York)", () => {
        const days = groupSlotsByDay([
            slot("2026-03-08T07:00:00.000Z"),
            slot("2026-03-09T03:30:00.000Z"),
            slot("2026-11-01T05:30:00.000Z"),
            slot("2026-11-01T06:30:00.000Z"),
            slot("2026-11-01T17:00:00.000Z"),
        ], "America/New_York");
        expect(days.map((d) => d.date)).toEqual([ "2026-03-08", "2026-11-01" ]);
        expect(days[ 0 ]!.morning).toHaveLength(1);
        expect(days[ 0 ]!.afternoon).toHaveLength(1);
        expect(days[ 1 ]!.morning).toHaveLength(2);
        expect(days[ 1 ]!.afternoon).toHaveLength(1);
    });
});

describe("weekPage", () => {
    it("starts on the Sunday of today's week, whatever the day, with no previous week", () => {
        for (const today of [ "2026-11-08", "2026-11-11", "2026-11-14" ]) {
            expect(weekPage(today, today, "2027-01-07")).toEqual({
                from: "2026-11-08", to: "2026-11-14", hasPrevious: false, hasNext: true,
            });
        }
    });

    it("pages by Sunday-to-Saturday weeks while the next week starts inside the horizon", () => {
        expect(weekPage("2026-11-15", "2026-11-11", "2027-01-07")).toEqual({
            from: "2026-11-15", to: "2026-11-21", hasPrevious: true, hasNext: true,
        });
        expect(weekPage("2026-11-11", "2026-11-11", "2026-11-15").hasNext).toBe(true);
        expect(weekPage("2026-11-11", "2026-11-11", "2026-11-14").hasNext).toBe(false);
    });

    it("crosses month and year boundaries when finding the Sunday", () => {
        expect(weekPage("2027-01-01", "2027-01-01", "2027-03-01")).toMatchObject({ from: "2026-12-27", to: "2027-01-02" });
    });

    it("cuts the last week at the last bookable date", () => {
        expect(weekPage("2027-01-03", "2026-11-11", "2027-01-07")).toEqual({
            from: "2027-01-03", to: "2027-01-07", hasPrevious: true, hasNext: false,
        });
        expect(weekPage("2026-11-11", "2026-11-11", "2026-11-11")).toMatchObject({ from: "2026-11-08", to: "2026-11-11", hasNext: false });
    });

    it("never inverts the range when today is past the last bookable date (stale profile, clock skew)", () => {
        expect(weekPage("2026-11-10", "2026-11-10", "2026-11-09")).toEqual({
            from: "2026-11-08", to: "2026-11-09", hasPrevious: false, hasNext: false,
        });
    });
});

describe("addCalendarDays", () => {
    it("crosses months, years and leap days", () => {
        expect(addCalendarDays("2026-12-29", 7)).toBe("2027-01-05");
        expect(addCalendarDays("2028-02-27", 2)).toBe("2028-02-29");
        expect(addCalendarDays("2026-11-09", -7)).toBe("2026-11-02");
    });
});

describe("fmtCop", () => {
    it("formats Colombian pesos without decimals", () => {
        expect(fmtCop(150000).replace(/\s/g, " ")).toMatch(/^\$ ?150\.000$/);
    });
});

describe("calendarDaysBetween", () => {
    it("lists every day from `from` to `to`, inclusive", () => {
        expect(calendarDaysBetween("2026-12-30", "2027-01-02")).toEqual([ "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02" ]);
        expect(calendarDaysBetween("2026-11-09", "2026-11-09")).toEqual([ "2026-11-09" ]);
    });
});

describe("fmtDayParts", () => {
    it("reads the calendar day, without trailing abbreviation dots", () => {
        expect(fmtDayParts("2026-11-09")).toEqual({ weekday: "lun", dayNumber: "9", full: "lunes, 9 de noviembre" });
    });
});

describe("fmtWeekRange", () => {
    it("names the month once inside a month, both months across one, and one day alone", () => {
        expect(fmtWeekRange("2026-11-09", "2026-11-15")).toBe("9 – 15 nov");
        expect(fmtWeekRange("2026-12-28", "2027-01-03")).toBe("28 dic – 3 ene");
        expect(fmtWeekRange("2026-11-09", "2026-11-09")).toBe("9 nov");
    });
});

describe("slotQueryRange", () => {
    it("pads the patient's week by two days each side, enough for any two zones", () => {
        expect(slotQueryRange("2026-11-09", "2026-11-15")).toEqual({ from: "2026-11-07", to: "2026-11-17" });
    });
});

describe("lastBookableDateIn", () => {
    it("converts the provider's last bookable date to the patient's calendar", () => {
        expect(lastBookableDateIn("America/Bogota", "2026-12-30", "America/Bogota")).toBe("2026-12-30");
        expect(lastBookableDateIn("Asia/Tokyo", "2026-12-30", "America/Bogota")).toBe("2026-12-31");
        expect(lastBookableDateIn("Pacific/Honolulu", "2026-12-30", "America/Bogota")).toBe("2026-12-30");
        expect(lastBookableDateIn("Pacific/Honolulu", "2026-12-30", "Asia/Tokyo")).toBe("2026-12-30");
        expect(lastBookableDateIn("Etc/GMT+12", "2026-12-30", "Pacific/Kiritimati")).toBe("2026-12-29");
    });
});

describe("localDayOf / fmtLongDay", () => {
    it("names the day an instant falls on in the patient's zone", () => {
        expect(localDayOf("2026-11-05T03:30:00.000Z", "America/Bogota")).toBe("2026-11-04");
        expect(localDayOf("2026-11-05T03:30:00.000Z", "Europe/Madrid")).toBe("2026-11-05");
        expect(fmtLongDay("2026-11-04")).toBe("miércoles, 4 de noviembre de 2026");
    });
});

describe("phone helpers", () => {
    it("normalizes and validates E.164 like the API", () => {
        expect(normalizePhone(" +57 (300) 111-2233 ")).toBe("+573001112233");
        expect(isE164("+573001112233")).toBe(true);
        expect(isE164("3001112233")).toBe(false);
        expect(isE164("+571234")).toBe(false);
    });
});
