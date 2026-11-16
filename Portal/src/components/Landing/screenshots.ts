import type { StaticImageData } from "next/image";
import calendar from "@/src/assets/screenshots/calendar.png";
import requests from "@/src/assets/screenshots/requests.png";
import bookingAvailability from "@/src/assets/screenshots/booking-availability.png";
import reminders from "@/src/assets/screenshots/reminders.png";
import medicalRecord from "@/src/assets/screenshots/medical-record.png";

/**
 * The product screenshots on the marketing pages. The images come from `pnpm run screenshots`
 * (e2e/screenshots.config.ts), taken on made-up data; sizes are the captured pixels (2x).
 * Retake them when these screens change visibly.
 */
export interface Screenshot {
    src: StaticImageData | string;
    width: number;
    height: number;
    alt: string;
    caption?: string;
    /** A single card rather than an app screen: no window frame, narrower. */
    bare?: boolean;
}

export const SCREENSHOTS = {
    calendar: {
        src: calendar,
        width: 2880,
        height: 1800,
        alt: "Calendario semanal de Patient Nova con las citas de cada día, los bloqueos de almuerzo y una solicitud en línea pendiente de revisión.",
        caption: "Tu semana: citas, horarios bloqueados y reservas en línea en el mismo calendario.",
    },
    requests: {
        src: requests,
        width: 2360,
        height: 1200,
        alt: "Bandeja de solicitudes de cita en línea pendientes, con el paciente, la fecha solicitada, el tipo de cita, el lugar y el tiempo que falta para que venzan.",
        caption: "Cada solicitud muestra quién la pidió, para cuándo y cuánto tiempo guarda el horario.",
    },
    bookingAvailability: {
        src: bookingAvailability,
        width: 1440,
        height: 1520,
        alt: "Disponibilidad semanal para reservas en línea: franjas horarias de lunes a sábado, con el domingo sin atención.",
        caption: "Tu horario de atención, por días y franjas.",
        bare: true,
    },
    reminders: {
        src: reminders,
        width: 2360,
        height: 1800,
        alt: "Historial de recordatorios enviados por WhatsApp y correo, con el estado de cada envío y la fecha programada.",
        caption: "Cada recordatorio con su canal y su estado.",
    },
    medicalRecord: {
        src: medicalRecord,
        width: 2360,
        height: 1800,
        alt: "Historia clínica individual con los datos generales del paciente y el motivo de consulta.",
        caption: "La historia clínica de cada paciente, con datos de ejemplo.",
    },
} satisfies Record<string, Screenshot>;
