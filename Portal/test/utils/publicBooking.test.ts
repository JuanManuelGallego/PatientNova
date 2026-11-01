import { describe, expect, it } from "vitest";
import { addCalendarDays, fmtCop, groupSlotsByDay, weekPage } from "@/src/utils/publicBooking";

const slot = (startUtc: string) => ({ startUtc, endUtc: startUtc });
const starts = (slots: { startUtc: string }[]) => slots.map((s) => s.startUtc);

describe("groupSlotsByDay", () => {
    it("groups by the provider's local date and splits at local noon (Bogota)", () => {
        const days = groupSlotsByDay([
            slot("2026-11-09T13:00:00.000Z"), // 08:00 Mon
            slot("2026-11-09T17:00:00.000Z"), // 12:00 Mon
            slot("2026-11-10T04:30:00.000Z"), // 23:30 Mon, already Tuesday in UTC
            slot("2026-11-10T14:00:00.000Z"), // 09:00 Tue
        ], "America/Bogota");
        expect(days.map((d) => d.date)).toEqual([ "2026-11-09", "2026-11-10" ]);
        expect(starts(days[ 0 ]!.morning)).toEqual([ "2026-11-09T13:00:00.000Z" ]);
        expect(starts(days[ 0 ]!.afternoon)).toEqual([ "2026-11-09T17:00:00.000Z", "2026-11-10T04:30:00.000Z" ]);
        expect(starts(days[ 1 ]!.morning)).toEqual([ "2026-11-10T14:00:00.000Z" ]);
    });

    it("uses each instant's own offset across DST changes (New York)", () => {
        const days = groupSlotsByDay([
            slot("2026-03-08T07:00:00.000Z"), // 03:00 EDT, just after the jump
            slot("2026-03-09T03:30:00.000Z"), // 23:30 EDT, still Mar 8
            slot("2026-11-01T05:30:00.000Z"), // 01:30 EDT
            slot("2026-11-01T06:30:00.000Z"), // 01:30 EST (repeated hour)
            slot("2026-11-01T17:00:00.000Z"), // 12:00 EST
        ], "America/New_York");
        expect(days.map((d) => d.date)).toEqual([ "2026-03-08", "2026-11-01" ]);
        expect(days[ 0 ]!.morning).toHaveLength(1);
        expect(days[ 0 ]!.afternoon).toHaveLength(1);
        expect(days[ 1 ]!.morning).toHaveLength(2);
        expect(days[ 1 ]!.afternoon).toHaveLength(1);
    });
});

describe("weekPage", () => {
    it("starts at today with no previous week, and pages while the next week starts inside the horizon", () => {
        expect(weekPage("2026-11-09", "2026-11-09", "2027-01-07")).toEqual({
            from: "2026-11-09", to: "2026-11-15", hasPrevious: false, hasNext: true,
        });
        expect(weekPage("2026-11-16", "2026-11-09", "2027-01-07").hasPrevious).toBe(true);
    });

    it("cuts the last week at the last bookable date", () => {
        expect(weekPage("2027-01-04", "2026-11-09", "2027-01-07")).toEqual({
            from: "2027-01-04", to: "2027-01-07", hasPrevious: true, hasNext: false,
        });
        expect(weekPage("2026-11-09", "2026-11-09", "2026-11-09")).toMatchObject({ to: "2026-11-09", hasNext: false });
        expect(weekPage("2026-11-09", "2026-11-09", "2026-11-16").hasNext).toBe(true);
        expect(weekPage("2026-11-09", "2026-11-09", "2026-11-15").hasNext).toBe(false);
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
