import type { PortalAppointment } from "@/src/types/PortalBooking";
import { localDayOf } from "@/src/utils/publicBooking";

const CRLF = "\r\n";
const MAX_LINE_OCTETS = 75;
const encoder = new TextEncoder();

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const escapeText = (value: string) =>
    value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

function foldLine(line: string): string {
    const parts: string[] = [];
    let current = "";
    let octets = 0;
    for (const char of line) {
        const size = encoder.encode(char).length;
        if (octets + size > MAX_LINE_OCTETS) {
            parts.push(current);
            current = " ";
            octets = 1;
        }
        current += char;
        octets += size;
    }
    parts.push(current);
    return parts.join(CRLF);
}

function placeOf(appointment: PortalAppointment): string | null {
    const { location, meeting } = appointment;
    if (meeting?.status === "ready") return meeting.url;
    if (!location) return null;
    return location.address ? `${location.name}, ${location.address}` : location.name;
}

function descriptionOf(appointment: PortalAppointment): string | null {
    const notes = [
        appointment.type?.name,
        appointment.meeting?.status === "pending" ? "El enlace de la videollamada llegará a tu correo." : null,
        appointment.location?.instructions,
    ];
    return notes.filter(Boolean).join("\n") || null;
}

export function buildAppointmentIcs(appointment: PortalAppointment, providerName: string, now = new Date()): string {
    const place = placeOf(appointment);
    const description = descriptionOf(appointment);
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Patient Nova//Reserva en linea//ES",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        `UID:${appointment.id}@patientnova.net`,
        `DTSTAMP:${icsDate(now.toISOString())}`,
        `DTSTART:${icsDate(appointment.startUtc)}`,
        `DTEND:${icsDate(appointment.endUtc)}`,
        `SUMMARY:${escapeText(`Cita con ${providerName}`)}`,
        ...(place ? [ `LOCATION:${escapeText(place)}` ] : []),
        ...(description ? [ `DESCRIPTION:${escapeText(description)}` ] : []),
        "END:VEVENT",
        "END:VCALENDAR",
    ];
    return lines.map(foldLine).join(CRLF) + CRLF;
}

export function downloadAppointmentIcs(appointment: PortalAppointment, providerName: string, timezone: string): void {
    const blob = new Blob([ buildAppointmentIcs(appointment, providerName) ], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cita-${localDayOf(appointment.startUtc, timezone)}.ics`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
