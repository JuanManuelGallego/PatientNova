"use client";

import { useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { addCalendarDays, lastDayOfMonth } from "@/src/utils/publicBooking";
import { TouchPickerField } from "./TouchPickerField";
import styles from "./Pickers.module.css";

dayjs.extend(utc);

export type DayRange = [string, string];

export interface RangePreset {
    label: string;
    range: DayRange;
}

/** Hoy, Esta semana (Monday to Sunday) and Este mes around `today`, a "YYYY-MM-DD" in the provider's zone. */
export function rangePresets(today: string): RangePreset[] {
    const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
    const monday = addCalendarDays(today, -weekday);
    const month = today.slice(0, 7);
    return [
        { label: "Hoy", range: [ today, today ] },
        { label: "Esta semana", range: [ monday, addCalendarDays(monday, 6) ] },
        { label: "Este mes", range: [ `${month}-01`, lastDayOfMonth(month) ] },
    ];
}

const fmtDay = (day: string) => `${day.slice(8)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
const sameRange = (a: DayRange | null, b: DayRange | null) => a?.[0] === b?.[0] && a?.[1] === b?.[1];
const dayValue = (day: string) => dayjs.utc(`${day}T00:00:00`);

interface Draft {
    from: string | null;
    to: string | null;
}

/**
 * The range filter on touch screens: presets first, and two single-day fields under "Personalizado". It only
 * emits complete ranges (or null), like antd's RangePicker; a half-filled Personalizado applies no range.
 */
export function TouchDateRange({ value, onChange, today, popupContainer, testId }: {
    value: DayRange | null;
    onChange: (range: DayRange | null) => void;
    today: string;
    popupContainer?: () => HTMLElement | null;
    testId?: string;
}) {
    const presets = rangePresets(today);
    const matchesPreset = (range: DayRange | null) => !!range && presets.some((p) => sameRange(p.range, range));
    const [ synced, setSynced ] = useState(value);
    const [ draft, setDraft ] = useState<Draft>({ from: value?.[0] ?? null, to: value?.[1] ?? null });
    const [ custom, setCustom ] = useState(!!value && !matchesPreset(value));
    // What the Desde/Hasta fields last emitted: its echo through `value` must not reset them.
    const [ own, setOwn ] = useState<{ range: DayRange | null } | null>(null);

    // A new value from outside (a preset, "Limpiar", the URL) replaces the draft.
    if (!sameRange(value, synced)) {
        setSynced(value);
        if (own && sameRange(own.range, value)) {
            setOwn(null);
        } else {
            setDraft({ from: value?.[0] ?? null, to: value?.[1] ?? null });
            setCustom(!!value && !matchesPreset(value));
        }
    }

    const pickPreset = (preset: RangePreset) => {
        if (!custom && sameRange(value, preset.range)) {
            onChange(null);
            return;
        }
        setCustom(false);
        onChange(preset.range);
    };
    const toggleCustom = () => {
        if (custom) {
            setCustom(false);
            setDraft({ from: null, to: null });
            if (value) onChange(null);
            return;
        }
        setCustom(true);
    };
    const emitOwn = (range: DayRange | null) => {
        setOwn({ range });
        onChange(range);
    };
    const update = (next: Draft) => {
        setDraft(next);
        if (next.from && next.to) emitOwn([ next.from, next.to ]);
        // An applied range the fields no longer show in full is withdrawn, so the list matches what they show.
        else if (value) emitOwn(null);
    };

    return (
        <div className={styles.range} data-testid={testId}>
            <div className={styles.presets} role="group" aria-label="Periodo">
                {presets.map((preset) => (
                    <button key={preset.label} type="button" className={styles.preset}
                        aria-pressed={!custom && sameRange(value, preset.range)} onClick={() => pickPreset(preset)}>
                        {preset.label}
                    </button>
                ))}
                <button type="button" className={styles.preset} aria-pressed={custom} onClick={toggleCustom}>
                    Personalizado
                </button>
            </div>
            {custom ? (
                <div className={styles.rangeFields}>
                    <label className={styles.rangeField}>
                        Desde
                        <TouchPickerField
                            kind="date"
                            value={draft.from ? dayValue(draft.from) : null}
                            onChange={(d) => {
                                if (!d) return;
                                const from = d.format("YYYY-MM-DD");
                                update({ from, to: draft.to && draft.to >= from ? draft.to : null });
                            }}
                            today={today}
                            format="DD/MM/YYYY"
                            placeholder="Selecciona fecha"
                            title="Desde"
                            popupContainer={popupContainer}
                            testId={testId ? `${testId}-from` : undefined}
                        />
                    </label>
                    <label className={styles.rangeField}>
                        Hasta
                        <TouchPickerField
                            kind="date"
                            value={draft.to ? dayValue(draft.to) : null}
                            onChange={(d) => {
                                if (!d) return;
                                update({ from: draft.from, to: d.format("YYYY-MM-DD") });
                            }}
                            today={today}
                            format="DD/MM/YYYY"
                            placeholder="Selecciona fecha"
                            title="Hasta"
                            disabledDate={(d) => !!draft.from && d.format("YYYY-MM-DD") < draft.from}
                            minMonth={draft.from ? draft.from.slice(0, 7) : undefined}
                            initialMonth={draft.from ? draft.from.slice(0, 7) : undefined}
                            popupContainer={popupContainer}
                            testId={testId ? `${testId}-to` : undefined}
                        />
                    </label>
                </div>
            ) : value && (
                <p className={styles.rangeSummary}>
                    {value[0] === value[1] ? fmtDay(value[0]) : `${fmtDay(value[0])} – ${fmtDay(value[1])}`}
                </p>
            )}
        </div>
    );
}
