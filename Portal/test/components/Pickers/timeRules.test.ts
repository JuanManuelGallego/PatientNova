import { describe, expect, it } from "vitest";
import {
    END_OF_DAY,
    conflictAt,
    firstAllowed,
    formatDuration,
    formatTime,
    limitRules,
    parseTime,
    resolveRules,
    timeOptions,
    timeProblem,
    toMinutes,
    toTimeValue,
} from "@/src/components/Pickers/timeRules";

const at = (text: string) => toMinutes(text)!;
const shown = (rules = resolveRules(), from?: number) => timeOptions(rules, from).map((o) => toTimeValue(o.minutes));

describe("time values", () => {
    it("reads and writes HH:mm, with 24:00 as the end of the day", () => {
        expect(toMinutes("09:30")).toBe(570);
        expect(toMinutes("24:00")).toBe(END_OF_DAY);
        expect(toMinutes("24:05")).toBeNull();
        expect(toMinutes("9:30")).toBeNull();
        expect(toTimeValue(570)).toBe("09:30");
        expect(toTimeValue(END_OF_DAY)).toBe("24:00");
    });
});

describe("formatTime", () => {
    it("shows 24 h with two-digit hours", () => {
        expect(formatTime(at("09:05"), "24h")).toBe("09:05");
        expect(formatTime(at("21:30"), "24h")).toBe("21:30");
    });

    it("shows 12 h the TimeUtils way, with no full stop after a. m./p. m.", () => {
        expect(formatTime(at("00:15"), "12h")).toBe("12:15 a. m.");
        expect(formatTime(at("09:05"), "12h")).toBe("9:05 a. m.");
        expect(formatTime(at("12:00"), "12h")).toBe("12:00 p. m.");
        expect(formatTime(at("21:30"), "12h")).toBe("9:30 p. m.");
    });
});

describe("formatDuration", () => {
    it("uses minutes under an hour, then hours", () => {
        expect(formatDuration(45)).toBe("45 min");
        expect(formatDuration(60)).toBe("1 h");
        expect(formatDuration(90)).toBe("1 h 30 min");
        expect(formatDuration(120)).toBe("2 h");
    });
});

describe("parseTime", () => {
    it.each([
        [ "935", "09:35" ], [ "9:35", "09:35" ], [ "9.35", "09:35" ], [ "9h35", "09:35" ], [ "09:35", "09:35" ],
        [ "9", "09:00" ], [ "21:30", "21:30" ], [ "9:30 pm", "21:30" ], [ "9:30 p. m.", "21:30" ], [ "930p", "21:30" ],
        [ "9 a. m.", "09:00" ], [ "12:15 a. m.", "00:15" ], [ "12 pm", "12:00" ], [ "24:00", "24:00" ], [ " 7:05 ", "07:05" ],
    ])("reads %j as %s", (text, value) => {
        expect(toTimeValue(parseTime(text)!)).toBe(value);
    });

    it.each([ "", "abc", "25", "9:75", "13 pm", "0 am", "24:30", "9:3" ])("refuses %j", (text) => {
        expect(parseTime(text)).toBeNull();
    });
});

describe("timeOptions", () => {
    it("lists the whole day every 15 minutes by default, ending at 23:45", () => {
        const values = shown();
        expect(values[0]).toBe("00:00");
        expect(values.at(-1)).toBe("23:45");
        expect(values).toHaveLength(96);
    });

    it("lists only between min and max, starting on the next row at or after min", () => {
        expect(shown(resolveRules({ min: "06:10", max: "07:00" }))).toEqual([ "06:15", "06:30", "06:45", "07:00" ]);
    });

    it("follows listStep", () => {
        expect(shown(resolveRules({ min: "08:00", max: "09:00", listStep: 30 }))).toEqual([ "08:00", "08:30", "09:00" ]);
    });

    it("lists an end field from just after its start, with the duration of each row", () => {
        const rules = resolveRules({ max: "11:00" });
        const options = timeOptions(rules, at("09:40"));
        expect(options.map((o) => toTimeValue(o.minutes))).toEqual([ "09:55", "10:10", "10:25", "10:40", "10:55" ]);
        expect(options.map((o) => o.duration)).toEqual([ 15, 30, 45, 60, 75 ]);
    });

    it("offers 24:00 as the last end only when the end of the day is allowed", () => {
        expect(shown(resolveRules({ endOfDay: true }), at("23:00")).at(-1)).toBe("24:00");
        expect(shown(resolveRules(), at("23:00")).at(-1)).toBe("23:45");
    });

    it("marks rows whose whole duration would overlap an unavailable span", () => {
        const rules = resolveRules({
            min: "09:00", max: "11:00", duration: 60,
            unavailable: [ { start: "10:30", end: "11:30", label: "Ocupada", detail: "Se cruza con la cita de 10:30" } ],
        });
        const marked = timeOptions(rules).map((o) => [ toTimeValue(o.minutes), o.unavailable?.label ?? null ]);
        expect(marked).toEqual([
            [ "09:00", null ], [ "09:15", null ], [ "09:30", null ], [ "09:45", "Ocupada" ], [ "10:00", "Ocupada" ],
            [ "10:15", "Ocupada" ], [ "10:30", "Ocupada" ], [ "10:45", "Ocupada" ], [ "11:00", "Ocupada" ],
        ]);
    });

    it("treats spans as half-open, so a time can start where one ends", () => {
        const rules = resolveRules({ duration: 30, unavailable: [ { start: "10:00", end: "10:30", label: "Ocupada" } ] });
        expect(conflictAt(rules, at("10:30"))).toBeUndefined();
        expect(conflictAt(rules, at("09:30"))).toBeUndefined();
        expect(conflictAt(rules, at("09:45"))?.label).toBe("Ocupada");
    });

    it("checks a single instant when there is no duration", () => {
        const rules = resolveRules({ unavailable: [ { start: "10:00", end: "10:30", label: "Ocupada" } ] });
        expect(conflictAt(rules, at("09:55"))).toBeUndefined();
        expect(conflictAt(rules, at("10:00"))?.label).toBe("Ocupada");
    });
});

describe("timeProblem", () => {
    const rules = resolveRules({ min: "06:00", max: "20:00", duration: 60, unavailable: [ { start: "10:30", end: "11:30", label: "Ocupada", detail: "Se cruza con la cita de 10:30 a 11:30" } ] });

    it("accepts an allowed time on the step", () => {
        expect(timeProblem(rules, at("09:25"), { format: "24h" })).toBeNull();
    });

    it("asks for the format when the text is not a time", () => {
        expect(timeProblem(rules, null, { format: "24h" })).toBe("Escribe la hora como 9:30");
        expect(timeProblem(rules, null, { format: "12h" })).toBe("Escribe la hora como 9:30 a. m.");
    });

    it("gives the allowed range for a time outside it or off the step", () => {
        const message = "Escribe una hora entre 06:00 y 20:00, en pasos de 5 min";
        expect(timeProblem(rules, at("05:55"), { format: "24h" })).toBe(message);
        expect(timeProblem(rules, at("20:05"), { format: "24h" })).toBe(message);
        expect(timeProblem(rules, at("09:32"), { format: "24h" })).toBe(message);
        expect(timeProblem(rules, at("05:55"), { format: "12h" })).toBe("Escribe una hora entre 6:00 a. m. y 8:00 p. m., en pasos de 5 min");
    });

    it("explains an overlap with the span's detail", () => {
        expect(timeProblem(rules, at("10:00"), { format: "24h" })).toBe("Se cruza con la cita de 10:30 a 11:30");
    });

    it("needs an end after its start", () => {
        expect(timeProblem(resolveRules(), at("09:00"), { from: at("09:00"), format: "24h" }))
            .toBe("Escribe una hora entre 09:05 y 23:55, en pasos de 5 min");
    });

    it("accepts 24:00 only where the end of the day is allowed", () => {
        expect(timeProblem(resolveRules({ endOfDay: true }), END_OF_DAY, { from: at("20:00"), format: "24h" })).toBeNull();
        expect(timeProblem(resolveRules(), END_OF_DAY, { from: at("20:00"), format: "24h" })).not.toBeNull();
    });
});

describe("limitRules", () => {
    it("raises min to a moment, rounded up to the step", () => {
        const rules = limitRules(resolveRules({ min: "06:00" }), { min: at("09:42") });
        expect(rules.min).toBe(at("09:45"));
    });

    it("never lowers min or raises max", () => {
        const rules = limitRules(resolveRules({ min: "10:00", max: "18:00" }), { min: at("08:00"), max: at("20:00") });
        expect([ rules.min, rules.max ]).toEqual([ at("10:00"), at("18:00") ]);
    });

    it("lowers max to a moment, rounded down to the step", () => {
        expect(limitRules(resolveRules(), { max: at("14:03") }).max).toBe(at("14:00"));
    });
});

describe("firstAllowed", () => {
    it("is the first row that is not unavailable", () => {
        const rules = resolveRules({ min: "08:00", unavailable: [ { start: "08:00", end: "08:30", label: "Ocupada" } ] });
        expect(toTimeValue(firstAllowed(rules)!)).toBe("08:30");
    });

    it("is null when nothing is left", () => {
        expect(firstAllowed(resolveRules({ min: "23:50", max: "23:55" }))).toBeNull();
    });
});
