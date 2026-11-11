import { describe, expect, it } from "vitest";
import { availabilityError, intervalGapWarning, minutesToTime, slugError, sortRules, timeToMinutes } from "@/src/utils/bookingAvailability";

const rule = (weekday: number, startMinute: number, endMinute: number) => ({ weekday, startMinute, endMinute });

describe("minutesToTime / timeToMinutes", () => {
    it("round-trips wall-clock times", () => {
        expect(minutesToTime(540)).toBe("09:00");
        expect(minutesToTime(1435)).toBe("23:55");
        expect(timeToMinutes("09:30")).toBe(570);
    });

    it("treats 00:00 as end of day only for end times", () => {
        expect(timeToMinutes("00:00")).toBe(0);
        expect(timeToMinutes("00:00", true)).toBe(1440);
    });

    it("rejects unparsable input", () => {
        expect(timeToMinutes("")).toBeNull();
        expect(timeToMinutes("9:00")).toBeNull();
        expect(timeToMinutes("25:00")).toBeNull();
    });
});

describe("slugError", () => {
    it.each([ "abc", "dra-maria", "consulta-2" ])("accepts %s", (s) => expect(slugError(s)).toBeNull());
    it.each([ "ab", "a".repeat(41), "-abc", "a--b", "peña", "dra maria" ])("rejects %s", (s) => expect(slugError(s)).not.toBeNull());
});

describe("availabilityError", () => {
    it("accepts touching windows and an empty week", () => {
        expect(availabilityError([])).toBeNull();
        expect(availabilityError([ rule(1, 540, 720), rule(1, 720, 900) ])).toBeNull();
    });

    it("rejects overlaps on the same weekday and names the day", () => {
        expect(availabilityError([ rule(3, 600, 720), rule(3, 540, 660) ])).toMatch(/miércoles/);
    });

    it("allows the same hours on different days", () => {
        expect(availabilityError([ rule(1, 540, 720), rule(2, 540, 720) ])).toBeNull();
    });

    it("rejects an end before the start and off-grid minutes", () => {
        expect(availabilityError([ rule(1, 600, 540) ])).not.toBeNull();
        expect(availabilityError([ rule(1, 541, 600) ])).not.toBeNull();
    });

    it("caps the week at the server's rule limit", () => {
        const many = Array.from({ length: 51 }, (_, i) => rule((i % 7) + 1, (Math.floor(i / 7)) * 60, (Math.floor(i / 7)) * 60 + 30));
        expect(availabilityError(many.slice(0, 50))).toBeNull();
        expect(availabilityError(many)).toMatch(/máximo 50/);
    });
});

describe("sortRules", () => {
    it("orders by weekday then start", () => {
        expect(sortRules([ rule(2, 600, 660), rule(1, 900, 960), rule(1, 540, 600) ])).toEqual([
            rule(1, 540, 600), rule(1, 900, 960), rule(2, 600, 660),
        ]);
    });
});

describe("intervalGapWarning", () => {
    it("recommends the appointment length when a shorter interval lets bookings leave gaps", () => {
        const warning = intervalGapWarning(30, 0, [ 60 ]);
        expect(warning).toContain("duran 60 min");
        expect(warning).toContain("usa 60 min");
    });

    it("stays quiet when the interval already chains appointments back to back", () => {
        expect(intervalGapWarning(60, 0, [ 60 ])).toBeNull();
        expect(intervalGapWarning(60, 0, [ 60, 120 ])).toBeNull();
    });

    it("counts the buffer in the distance between appointments", () => {
        expect(intervalGapWarning(60, 10, [ 50 ])).toBeNull();
        const warning = intervalGapWarning(60, 15, [ 60 ]);
        expect(warning).toContain("más 15 min entre citas");
        expect(warning).toContain("usa 15 min");
    });

    it("warns about intervals that are longer or misaligned too", () => {
        expect(intervalGapWarning(120, 0, [ 60 ])).toContain("usa 60 min");
        expect(intervalGapWarning(30, 0, [ 45 ])).toContain("usa 45 min");
    });

    it("recommends a common divisor for mixed lengths and accepts it", () => {
        expect(intervalGapWarning(30, 0, [ 45, 60 ])).toContain("duran 45 y 60 min");
        expect(intervalGapWarning(30, 0, [ 45, 60 ])).toContain("usa 15 min");
        expect(intervalGapWarning(15, 0, [ 60, 45, 60 ])).toBeNull();
    });

    it("stays quiet without bookable types, with an invalid buffer, or when no option fits", () => {
        expect(intervalGapWarning(30, 0, [])).toBeNull();
        expect(intervalGapWarning(30, Number.NaN, [ 60 ])).toBeNull();
        expect(intervalGapWarning(30, 0, [ 52 ])).toBeNull();
    });
});
