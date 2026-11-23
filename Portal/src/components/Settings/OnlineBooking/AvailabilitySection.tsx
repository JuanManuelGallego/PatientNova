"use client";

import { useState } from "react";
import { TimeRangeField, type TimeRange } from "@/src/components/Pickers/TimeRangeField";
import { useFetchAvailability } from "@/src/api/booking/useFetchAvailability";
import { useSaveAvailability } from "@/src/api/booking/useSaveAvailability";
import { AvailabilityRule } from "@/src/types/Booking";
import {
    MINUTES_PER_DAY,
    WEEKDAYS_ES,
    availabilityError,
    minutesToTime,
    sortRules,
    timeToMinutes,
} from "@/src/utils/bookingAvailability";
import { SaveStatusIndicator } from "@/src/components/Info/SaveStatusIndicator";
import { FieldError, InlineError } from "@/src/components/Info/InlineError";
import { ACTION_ICONS } from "@/src/config/icons";
import { LBL_LOADING } from "@/src/constants/ui";
import { useDebouncedSave } from "@/src/hooks/useDebouncedSave";
import { AVAILABILITY_SECTION_ID, WarningHint } from "./shared";
import { SettingsSection } from "../SettingsSection";

const DEFAULT_WINDOW = { startMinute: 9 * 60, endMinute: 12 * 60 };
const WORKWEEK = [ 1, 2, 3, 4, 5 ];

export function AvailabilitySection({ onSaved }: { onSaved: () => Promise<void> }) {
    const { availability, loading, error: loadError } = useFetchAvailability();
    const { saveAvailability } = useSaveAvailability();
    const [ draft, setDraft ] = useState<AvailabilityRule[] | null>(null);
    const dirty = draft !== null;
    const rules = draft ?? availability?.rules ?? null;
    const autosave = useDebouncedSave<AvailabilityRule[]>(async (next) => {
        await saveAvailability(next);
        await onSaved();
    });

    const validation = rules ? availabilityError(rules) : null;
    const dayErrors = new Map(WEEKDAYS_ES.map(({ weekday }) => [ weekday, rules ? availabilityError(rules.filter((r) => r.weekday === weekday)) : null ]));
    const anyDayError = [ ...dayErrors.values() ].some(Boolean);

    function update(next: AvailabilityRule[]) {
        setDraft(next);
        if (availabilityError(next)) autosave.cancel();
        else autosave.schedule(sortRules(next));
    }

    function addWindow(weekday: number) {
        const current = rules ?? [];
        const sameDay = sortRules(current.filter((r) => r.weekday === weekday));
        const last = sameDay[ sameDay.length - 1 ];
        if (last && last.endMinute >= MINUTES_PER_DAY) return;
        const startMinute = !last ? DEFAULT_WINDOW.startMinute
            : last.endMinute + 60 < MINUTES_PER_DAY ? last.endMinute + 60
            : last.endMinute;
        const endMinute = last ? Math.min(startMinute + 180, MINUTES_PER_DAY) : DEFAULT_WINDOW.endMinute;
        update([ ...current, { weekday, startMinute, endMinute } ]);
    }

    function copyToWorkweek(weekday: number) {
        if (!rules) return;
        const source = rules.filter((r) => r.weekday === weekday);
        const targets = WORKWEEK.filter((d) => d !== weekday);
        update([
            ...rules.filter((r) => !targets.includes(r.weekday)),
            ...targets.flatMap((d) => source.map((r) => ({ ...r, weekday: d }))),
        ]);
    }

    function setRange(target: AvailabilityRule, range: TimeRange) {
        const startMinute = timeToMinutes(range.start);
        const endMinute = timeToMinutes(range.end);
        if (startMinute === null || endMinute === null || !rules) return;
        update(rules.map((r) => (r === target ? { ...r, startMinute, endMinute } : r)));
    }

    return (
        <SettingsSection title="Disponibilidad semanal" status={<SaveStatusIndicator saving={autosave.saving} status={autosave.status} error={autosave.error} testId="availability-save-state" />} id={AVAILABILITY_SECTION_ID}>
            <div className="form-stack" data-testid="online-booking-availability">
                <span className="form-input-hint" style={{ alignSelf: "flex-start" }}>
                    Horarios en los que los pacientes pueden reservar.
                    Las citas y bloqueos de tu agenda se descuentan automáticamente.
                </span>
                {loadError && <InlineError message={loadError} />}
                {!rules && loading && <p className="form-input-hint">{LBL_LOADING}</p>}
                {rules && WEEKDAYS_ES.map(({ weekday, label }) => {
                    const dayRules = rules.filter((r) => r.weekday === weekday);
                    const dayFull = dayRules.some((r) => r.endMinute >= MINUTES_PER_DAY);
                    const dayError = dirty ? dayErrors.get(weekday) : null;
                    return (
                        <div
                            key={weekday}
                            style={{ display: "grid", gridTemplateColumns: "minmax(80px, 110px) 1fr", gap: 12, alignItems: "start", borderTop: "1px solid var(--c-gray-100)", paddingTop: 10 }}
                            data-testid={`availability-day-${weekday}`}
                        >
                            <span style={{ fontWeight: 600, fontSize: 13, paddingTop: 8 }}>{label}</span>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {dayRules.map((r, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                        <TimeRangeField
                                            value={{ start: minutesToTime(r.startMinute), end: minutesToTime(r.endMinute) }}
                                            onChange={(range) => setRange(r, range)}
                                            startLabel={`${label}: hora de inicio`}
                                            endLabel={`${label}: hora de fin`}
                                            endOfDay
                                            invalid={!!dayError}
                                            startTestId={`availability-start-${weekday}-${i}`}
                                            endTestId={`availability-end-${weekday}-${i}`}
                                        />
                                        {r.endMinute === MINUTES_PER_DAY && (
                                            <span style={{ fontSize: 12, color: "var(--c-gray-500)" }}>fin del día</span>
                                        )}
                                        <button
                                            type="button"
                                            className="btn-action-delete"
                                            onClick={() => update(rules.filter((x) => x !== r))}
                                            title="Quitar franja"
                                            aria-label={`${label}: quitar franja`}
                                            data-testid={`availability-remove-${weekday}-${i}`}
                                        >
                                            <ACTION_ICONS.delete size={14} aria-hidden="true" />
                                        </button>
                                    </div>
                                ))}
                                {dayError && <FieldError message={dayError} />}
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    {dayRules.length === 0 && (
                                        <span style={{ fontSize: 13, color: "var(--c-gray-500)", marginRight: 4 }}>No disponible</span>
                                    )}
                                    <button
                                        type="button"
                                        className="btn-action-edit"
                                        onClick={() => addWindow(weekday)}
                                        disabled={dayFull}
                                        aria-label={`${label}: agregar franja`}
                                        data-testid={`availability-add-${weekday}`}
                                    >
                                        <ACTION_ICONS.plus size={14} /> Agregar franja
                                    </button>
                                    {dayRules.length > 0 && (
                                        <button
                                            type="button"
                                            className="btn-action-edit"
                                            onClick={() => copyToWorkweek(weekday)}
                                            aria-label={`Copiar el horario del ${label.toLowerCase()} a lunes–viernes`}
                                            data-testid={`availability-copy-${weekday}`}
                                        >
                                            <ACTION_ICONS.copy size={14} /> Copiar a lunes–viernes
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {validation && dirty && !anyDayError && <InlineError message={validation} />}
                {validation && dirty && (
                    <WarningHint testId="availability-unsaved">Corrige los horarios marcados para guardar los cambios.</WarningHint>
                )}
                {autosave.error && <InlineError message={autosave.error} />}
            </div>
        </SettingsSection>
    );
}
