import { AvailabilityRule, MAX_AVAILABILITY_RULES } from "@/src/types/Booking";

/** Mirrors the server's slug rule (`Server/src/booking-settings/slug.ts`). */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;

/** ISO weekdays, Monday first, matching `AvailabilityRule.weekday`. */
export const WEEKDAYS_ES: ReadonlyArray<{ weekday: number; label: string }> = [
    { weekday: 1, label: "Lunes" },
    { weekday: 2, label: "Martes" },
    { weekday: 3, label: "Miércoles" },
    { weekday: 4, label: "Jueves" },
    { weekday: 5, label: "Viernes" },
    { weekday: 6, label: "Sábado" },
    { weekday: 7, label: "Domingo" },
];

export const MINUTES_PER_DAY = 1440;
const MINUTE_STEP = 5;

/** Spanish validation message for a slug, or null when it's acceptable to send. */
export function slugError(slug: string): string | null {
    if (slug.length < SLUG_MIN_LENGTH) return `El enlace debe tener al menos ${SLUG_MIN_LENGTH} caracteres.`;
    if (slug.length > SLUG_MAX_LENGTH) return `El enlace puede tener máximo ${SLUG_MAX_LENGTH} caracteres.`;
    if (!SLUG_PATTERN.test(slug)) return "Usa solo letras minúsculas, números y guiones (sin espacios, tildes ni guiones dobles).";
    return null;
}

/** 540 → "09:00"; 1440 → "24:00" (end of day). */
export function minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "09:00" → 540. "00:00" as an end time means midnight (1440); pass `asEnd`. Returns null when unparsable. */
export function timeToMinutes(value: string, asEnd = false): number | null {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const h = Number(match[ 1 ]);
    const m = Number(match[ 2 ]);
    if (h > 24 || m > 59 || (h === 24 && m > 0)) return null;
    const total = h * 60 + m;
    return asEnd && total === 0 ? MINUTES_PER_DAY : total;
}

export function sortRules(rules: AvailabilityRule[]): AvailabilityRule[] {
    return [ ...rules ].sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);
}

/** Spanish message for the first invalid window (same rules as the server), or null. */
export function availabilityError(rules: AvailabilityRule[]): string | null {
    if (rules.length > MAX_AVAILABILITY_RULES) {
        return `Puedes tener máximo ${MAX_AVAILABILITY_RULES} franjas en la semana.`;
    }
    for (const r of rules) {
        if (r.startMinute % MINUTE_STEP !== 0 || r.endMinute % MINUTE_STEP !== 0) {
            return "Las horas deben ir en intervalos de 5 minutos.";
        }
        if (r.startMinute < 0 || r.endMinute > MINUTES_PER_DAY || r.endMinute <= r.startMinute) {
            return "La hora de fin debe ser posterior a la hora de inicio.";
        }
    }
    const sorted = sortRules(rules);
    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[ i - 1 ];
        const cur = sorted[ i ];
        // Half-open windows: touching is allowed.
        if (cur.weekday === prev.weekday && cur.startMinute < prev.endMinute) {
            const day = WEEKDAYS_ES.find((d) => d.weekday === cur.weekday)?.label ?? "";
            return `Hay franjas que se superponen el ${day.toLowerCase()}.`;
        }
    }
    return null;
}
