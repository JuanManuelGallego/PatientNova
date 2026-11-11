import { AvailabilityRule, MAX_AVAILABILITY_RULES, SLOT_INTERVAL_OPTIONS } from "@/src/types/Booking";

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;

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

export function slugError(slug: string): string | null {
    if (slug.length < SLUG_MIN_LENGTH) return `El enlace debe tener al menos ${SLUG_MIN_LENGTH} caracteres.`;
    if (slug.length > SLUG_MAX_LENGTH) return `El enlace puede tener máximo ${SLUG_MAX_LENGTH} caracteres.`;
    if (!SLUG_PATTERN.test(slug)) return "Usa solo letras minúsculas, números y guiones (sin espacios, tildes ni guiones dobles).";
    return null;
}

export function minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

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
        if (cur.weekday === prev.weekday && cur.startMinute < prev.endMinute) {
            const day = WEEKDAYS_ES.find((d) => d.weekday === cur.weekday)?.label ?? "";
            return `Hay franjas que se superponen el ${day.toLowerCase()}.`;
        }
    }
    return null;
}

function listEs(values: readonly number[]): string {
    return values.length === 1 ? String(values[ 0 ]) : `${values.slice(0, -1).join(", ")} y ${values[ values.length - 1 ]}`;
}

export function intervalGapWarning(interval: number, buffer: number, durations: readonly number[]): string | null {
    if (!durations.length || !Number.isInteger(buffer) || buffer < 0) return null;
    const lengths = [ ...new Set(durations) ].sort((a, b) => a - b);
    const pitches = lengths.map((d) => d + buffer);
    const recommended = [ ...SLOT_INTERVAL_OPTIONS ].reverse()
        .find((o) => o <= pitches[ 0 ] && pitches.every((p) => p % o === 0));
    if (recommended === undefined || recommended === interval) return null;
    const occupy = buffer > 0 ? `duran ${listEs(lengths)} min, más ${buffer} min entre citas` : `duran ${listEs(lengths)} min`;
    return `Tus tipos de cita en línea ${occupy}. Con un intervalo de ${interval} min pueden quedar espacios libres entre citas; `
        + `usa ${recommended} min para que queden seguidas.`;
}
