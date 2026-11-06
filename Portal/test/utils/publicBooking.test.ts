import { describe, expect, it } from "vitest";
import {
    addCalendarDays, addMonths, calendarDaysBetween, fmtMonth, fmtShortDayTime, lastBookableDateIn, lastDayOfMonth, mergeSlots, monthGrid, monthOf, slotQueryRange, slotWindow, fmtBookingPolicy, fmtCop, fmtDayParts, fmtLongDay, fmtPhone, groupSlotsByDay,
    isE164, localDayOf, mapUrl, normalizePhone, whatsappUrl,
} from "@/src/utils/publicBooking";

const slot = (startUtc: string) => ({ startUtc, endUtc: startUtc });
const starts = (slots: { startUtc: string }[]) => slots.map((s) => s.startUtc);

describe("fmtBookingPolicy", () => {
    const CANCEL = "Puedes cancelarla desde Mis citas en cualquier momento antes de la cita";

    it("only mentions cancelling when rescheduling is not offered online", () => {
        expect(fmtBookingPolicy(null)).toBe(`${CANCEL}.`);
    });

    it("says so when the provider allows no reschedules", () => {
        expect(fmtBookingPolicy({ maxReschedules: 0, minNoticeHours: 24 })).toBe(`${CANCEL}. No se puede reprogramar en línea.`);
    });

    it("states the limit, in singular or plural, and the notice only when there is one", () => {
        expect(fmtBookingPolicy({ maxReschedules: 1, minNoticeHours: 0 })).toBe(`${CANCEL} y reprogramarla hasta 1 vez.`);
        expect(fmtBookingPolicy({ maxReschedules: 2, minNoticeHours: 1 })).toBe(`${CANCEL} y reprogramarla hasta 2 veces, con al menos 1 hora de anticipación.`);
        expect(fmtBookingPolicy({ maxReschedules: 3, minNoticeHours: 24 })).toBe(`${CANCEL} y reprogramarla hasta 3 veces, con al menos 24 horas de anticipación.`);
    });
});

describe("provider contact links", () => {
    it("groups a Colombian mobile number and leaves other numbers as stored", () => {
        expect(fmtPhone("+573001112222")).toBe("+57 300 111 2222");
        expect(fmtPhone("+14155552671")).toBe("+14155552671");
    });

    it("builds a WhatsApp chat link from digits only", () => {
        expect(whatsappUrl("+573001112222")).toBe("https://wa.me/573001112222");
    });

    it("encodes the address of a map link", () => {
        expect(mapUrl("Calle 10 #20-30, Medellín")).toBe("https://www.google.com/maps/search/?api=1&query=Calle%2010%20%2320-30%2C%20Medell%C3%ADn");
    });
});

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

describe("slotWindow", () => {
    it("keeps every padded query inside the 31-day API limit", () => {
        const window = slotWindow(0, "2026-11-05", "2027-12-31");
        const query = slotQueryRange(window.from, window.to);
        expect(calendarDaysBetween(query.from, query.to).length - 1).toBeLessThan(31);
    });

    it("follows on from the previous window with no gap", () => {
        const first = slotWindow(0, "2026-11-05", "2027-12-31");
        expect(slotWindow(1, "2026-11-05", "2027-12-31").from).toBe(addCalendarDays(first.to, 1));
    });

    it("cuts at the last bookable date and has no next window", () => {
        expect(slotWindow(0, "2026-11-05", "2026-11-10")).toEqual({ from: "2026-11-05", to: "2026-11-10", hasNext: false });
    });

    it("has no next window when it ends exactly on the last bookable date", () => {
        const first = slotWindow(0, "2026-11-05", "2027-12-31");
        expect(slotWindow(0, "2026-11-05", first.to).hasNext).toBe(false);
    });
});

describe("mergeSlots", () => {
    it("drops duplicates from overlapping padding and sorts by start", () => {
        const later = slot("2026-11-06T14:00:00.000Z");
        const earlier = slot("2026-11-05T14:00:00.000Z");
        expect(starts(mergeSlots([ later ], [ later, earlier ]))).toEqual([ earlier.startUtc, later.startUtc ]);
    });
});

describe("month helpers", () => {
    it("names the month of a day", () => {
        expect(monthOf("2026-11-05")).toBe("2026-11");
    });

    it("starts the grid on Sunday with blanks and ends on the last day", () => {
        const grid = monthGrid("2026-12"); // 1 December 2026 is a Tuesday
        expect(grid.slice(0, 3)).toEqual([ null, null, "2026-12-01" ]);
        expect(grid.at(-1)).toBe("2026-12-31");
    });

    it("crosses the year and knows February", () => {
        expect(addMonths("2026-12", 1)).toBe("2027-01");
        expect(addMonths("2027-01", -1)).toBe("2026-12");
        expect(lastDayOfMonth("2028-02")).toBe("2028-02-29");
    });

    it("formats the month in Spanish", () => {
        expect(fmtMonth("2026-11")).toBe("noviembre de 2026");
    });
});

describe("fmtShortDayTime", () => {
    it("names the day in the given zone", () => {
        expect(fmtShortDayTime("2026-11-07T02:00:00.000Z", "America/Bogota")).toMatch(/^vie 6 nov, 0?9:00/);
    });
});
