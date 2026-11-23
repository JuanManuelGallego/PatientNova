
export type TimeFormat = "24h" | "12h";

export const END_OF_DAY = 24 * 60;
const LAST_MINUTE = END_OF_DAY - 5;

export interface TimeSpan {
    start: string;
    end: string;
    label: string;
    detail?: string;
}

export interface TimeRules {
    min?: string;
    max?: string;
    step?: number;
    listStep?: number;
    duration?: number;
    unavailable?: TimeSpan[];
    endOfDay?: boolean;
}

export interface ResolvedSpan {
    start: number;
    end: number;
    label: string;
    detail?: string;
}

export interface ResolvedRules {
    min: number;
    max: number;
    step: number;
    listStep: number;
    duration: number;
    unavailable: ResolvedSpan[];
}

export interface TimeOption {
    minutes: number;
    unavailable?: ResolvedSpan;
    duration?: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toMinutes(value: string): number | null {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (m > 59 || h > 24 || (h === 24 && m > 0)) return null;
    return h * 60 + m;
}

export function toTimeValue(minutes: number): string {
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function formatTime(minutes: number, format: TimeFormat): string {
    if (format === "24h") return toTimeValue(minutes);
    const h = Math.floor(minutes / 60) % 24;
    return `${h % 12 === 0 ? 12 : h % 12}:${pad(minutes % 60)} ${h < 12 ? "a. m." : "p. m."}`;
}

export function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const rest = minutes % 60;
    return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${minutes / 60} h`;
}

export function parseTime(text: string): number | null {
    const compact = text.trim().toLowerCase().replace(/\s+/g, "");
    const match = /^(\d{1,2})(?:[:.h]?(\d{2}))?(?:([ap])\.?(?:m\.?)?)?$/.exec(compact);
    if (!match) return null;
    let h = Number(match[1]);
    const m = match[2] ? Number(match[2]) : 0;
    if (m > 59) return null;
    if (match[3]) {
        if (h < 1 || h > 12) return null;
        h = (h % 12) + (match[3] === "p" ? 12 : 0);
    } else if (h === 24) {
        return m === 0 ? END_OF_DAY : null;
    } else if (h > 23) {
        return null;
    }
    return h * 60 + m;
}

export function resolveRules(rules: TimeRules = {}): ResolvedRules {
    const min = rules.min ? toMinutes(rules.min) : null;
    const max = rules.max ? toMinutes(rules.max) : null;
    return {
        min: min ?? 0,
        max: max ?? (rules.endOfDay ? END_OF_DAY : LAST_MINUTE),
        step: Math.max(1, rules.step ?? 5),
        listStep: Math.max(1, rules.listStep ?? 15),
        duration: Math.max(0, rules.duration ?? 0),
        unavailable: (rules.unavailable ?? []).flatMap((span) => {
            const start = toMinutes(span.start);
            const end = toMinutes(span.end);
            return start === null || end === null ? [] : [ { start, end, label: span.label, detail: span.detail } ];
        }),
    };
}

export function limitRules(rules: ResolvedRules, limits: { min?: number; max?: number }): ResolvedRules {
    const min = limits.min === undefined ? rules.min : Math.max(rules.min, Math.ceil(limits.min / rules.step) * rules.step);
    const max = limits.max === undefined ? rules.max : Math.min(rules.max, Math.floor(limits.max / rules.step) * rules.step);
    return { ...rules, min, max };
}

export function conflictAt(rules: ResolvedRules, minutes: number): ResolvedSpan | undefined {
    const end = minutes + Math.max(rules.duration, 1);
    return rules.unavailable.find((span) => minutes < span.end && end > span.start);
}

export function timeOptions(rules: ResolvedRules, from?: number | null): TimeOption[] {
    const options: TimeOption[] = [];
    const first = from != null ? from + rules.listStep : Math.ceil(rules.min / rules.listStep) * rules.listStep;
    for (let minutes = first; minutes <= rules.max; minutes += rules.listStep) {
        if (minutes < rules.min) continue;
        options.push({ minutes, unavailable: conflictAt(rules, minutes), duration: from != null ? minutes - from : undefined });
    }
    return options;
}

export function firstAllowed(rules: ResolvedRules, from?: number | null): number | null {
    return timeOptions(rules, from).find((option) => !option.unavailable)?.minutes ?? null;
}

export function timeProblem(
    rules: ResolvedRules,
    minutes: number | null,
    { from = null, format }: { from?: number | null; format: TimeFormat },
): string | null {
    if (minutes === null) return `Escribe la hora como ${format === "12h" ? "9:30 a. m." : "9:30"}`;
    const lowest = from != null ? Math.max(rules.min, from + rules.step) : rules.min;
    if (minutes < lowest || minutes > rules.max || minutes % rules.step !== 0) {
        return `Escribe una hora entre ${formatTime(lowest, format)} y ${formatTime(rules.max, format)}, en pasos de ${rules.step} min`;
    }
    const span = conflictAt(rules, minutes);
    return span ? span.detail ?? span.label : null;
}
