import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAppointmentIcs, downloadAppointmentIcs } from "@/src/utils/appointmentCalendar";
import type { PortalAppointment } from "@/src/types/PortalBooking";

const NOW = new Date("2026-11-04T12:00:00.000Z");

const appointment = (overrides: Partial<PortalAppointment> = {}): PortalAppointment => ({
    id: "a1",
    startUtc: "2026-11-10T14:00:00.000Z",
    endUtc: "2026-11-10T15:00:00.000Z",
    durationMinutes: 60,
    status: "CONFIRMED",
    price: 150000,
    type: { name: "Primera consulta" },
    location: { name: "Consultorio Centro", address: "Calle 10", instructions: "Timbre 2", isVirtual: false },
    meeting: null,
    canCancel: true,
    canReschedule: true,
    ...overrides,
});

const unfold = (ics: string) => ics.replace(/\r\n /g, "");

describe("buildAppointmentIcs", () => {
    it("writes one UTC event with CRLF line ends", () => {
        const ics = buildAppointmentIcs(appointment(), "Dra. Ana", NOW);
        expect(ics.split("\r\n").slice(0, 2)).toEqual([ "BEGIN:VCALENDAR", "VERSION:2.0" ]);
        expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
        expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
        expect(ics).toContain("UID:a1@patientnova.net\r\n");
        expect(ics).toContain("DTSTAMP:20261104T120000Z\r\n");
        expect(ics).toContain("DTSTART:20261110T140000Z\r\n");
        expect(ics).toContain("DTEND:20261110T150000Z\r\n");
        expect(ics).toContain("SUMMARY:Cita con Dra. Ana\r\n");
    });

    it("escapes text and keeps the place, the type and the instructions", () => {
        const ics = buildAppointmentIcs(appointment({
            location: { name: "Sede; Norte", address: "Calle 10, Piso 2", instructions: "Timbre 2\nPreguntar en recepción", isVirtual: false },
        }), "Dra. Ana", NOW);
        const text = unfold(ics);
        expect(text).toContain("LOCATION:Sede\\; Norte\\, Calle 10\\, Piso 2\r\n");
        expect(text).toContain("DESCRIPTION:Primera consulta\\nTimbre 2\\nPreguntar en recepción\r\n");
    });

    it("uses the meeting link as the place once it is ready", () => {
        const ics = buildAppointmentIcs(appointment({
            location: { name: "Virtual", address: null, instructions: null, isVirtual: true },
            meeting: { status: "ready", url: "https://meet.google.com/abc-defg-hij" },
        }), "Dra. Ana", NOW);
        expect(unfold(ics)).toContain("LOCATION:https://meet.google.com/abc-defg-hij\r\n");
    });

    it("never prints a placeholder for a link that is still pending", () => {
        const ics = unfold(buildAppointmentIcs(appointment({
            location: { name: "Virtual", address: null, instructions: null, isVirtual: true },
            meeting: { status: "pending" },
        }), "Dra. Ana", NOW));
        expect(ics).toContain("LOCATION:Virtual\r\n");
        expect(ics).toContain("El enlace de la videollamada llegará a tu correo.");
    });

    it("omits the optional lines when there is nothing to say", () => {
        const ics = buildAppointmentIcs(appointment({ location: null, type: null }), "Dra. Ana", NOW);
        expect(ics).not.toContain("LOCATION:");
        expect(ics).not.toContain("DESCRIPTION:");
    });

    it("folds long lines at 75 octets without splitting a multi-byte character", () => {
        const name = "Consultorio de Psicología Clínica".repeat(5);
        const ics = buildAppointmentIcs(appointment({
            location: { name, address: null, instructions: null, isVirtual: false },
        }), "Dra. Ana", NOW);
        const encoder = new TextEncoder();
        for (const line of ics.split("\r\n")) expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
        expect(ics).not.toContain("�");
        expect(unfold(ics)).toContain(`LOCATION:${name}\r\n`);
    });
});

describe("downloadAppointmentIcs", () => {
    afterEach(() => vi.restoreAllMocks());

    it("downloads a calendar file named after the patient's local day", async () => {
        const created: Blob[] = [];
        URL.createObjectURL = vi.fn((blob: Blob) => { created.push(blob); return "blob:ics"; });
        URL.revokeObjectURL = vi.fn();
        let download = "";
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
            download = this.download;
        });

        // 01:00 UTC on the 11th is still the 10th in Bogotá.
        downloadAppointmentIcs(appointment({ startUtc: "2026-11-11T01:00:00.000Z", endUtc: "2026-11-11T02:00:00.000Z" }), "Dra. Ana", "America/Bogota");

        expect(download).toBe("cita-2026-11-10.ics");
        expect(created[ 0 ]!.type).toBe("text/calendar;charset=utf-8");
        expect(document.querySelector("a[download]")).toBeNull();
    });
});
