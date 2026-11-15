"use client";

import { useId, useState } from "react";
import { useAuthContext } from "@/src/providers/AuthContext";
import { useFetchAppointmentTypes } from "@/src/api/appointment-types/useFetchAppointmentTypes";
import {
    BookingSettings,
    BookingSettingsUpdate,
    MAX_PATIENT_RESCHEDULES,
    MAX_RESCHEDULE_NOTICE_HOURS,
    PORTAL_REMINDER_TIMINGS,
    PortalReminderTiming,
    SLOT_INTERVAL_OPTIONS,
} from "@/src/types/Booking";
import { REMINDER_TYPE_CONFIG } from "@/src/types/Reminder";
import { intervalGapWarning } from "@/src/utils/bookingAvailability";
import { CustomSelect } from "@/src/components/CustomSelect";
import { SaveStatusIndicator } from "@/src/components/Info/SaveStatusIndicator";
import { FieldError, InlineError } from "@/src/components/Info/InlineError";
import { useDebouncedSave } from "@/src/hooks/useDebouncedSave";
import { WarningHint, type SaveFn } from "./shared";
import { SettingsSection } from "../SettingsSection";

const toNumber = (s: string) => (s.trim() === "" ? NaN : Number(s));

function reminderTimingHint(timing: PortalReminderTiming): string {
    if (timing === "NONE") return "Las citas reservadas en línea no reciben recordatorio automático.";
    const preset = PORTAL_REMINDER_TIMINGS.find((t) => t.value === timing);
    if (!preset) return "Se envía por el canal de cada paciente.";
    const { label, clock } = REMINDER_TYPE_CONFIG[ preset.type ];
    const when = clock
        ? `la ${label.toLowerCase()} (${clock.hour}:${String(clock.minute).padStart(2, "0")})`
        : `${label} de la cita`;
    return `Se envía ${when}, por el canal de cada paciente. Si la cita se reserva o se mueve después de ese momento, no se envía.`;
}

type RulesForm = {
    interval: number; buffer: string; lead: string; horizon: string; reschedules: string; notice: string;
    reminderTiming: PortalReminderTiming;
};

function rulesFormOf(s: BookingSettings): RulesForm {
    return {
        interval: s.slotIntervalMinutes,
        buffer: String(s.bufferMinutes),
        lead: String(s.minLeadMinutes / 60),
        horizon: String(s.maxHorizonDays),
        reschedules: String(s.maxPatientReschedules),
        notice: String(s.minRescheduleNoticeHours),
        reminderTiming: s.portalReminderTiming,
    };
}

function parseRules(form: RulesForm) {
    const buffer = toNumber(form.buffer);
    const leadMinutes = Math.round(toNumber(form.lead) * 60);
    const horizon = toNumber(form.horizon);
    const reschedules = toNumber(form.reschedules);
    const notice = toNumber(form.notice);
    const leadError = Number.isFinite(leadMinutes) && leadMinutes >= 0 && leadMinutes <= 14 * 24 * 60 ? null : "Escribe un número entre 0 y 336 horas (14 días).";
    const errors = {
        buffer: Number.isInteger(buffer) && buffer >= 0 && buffer <= 240 ? null : "Escribe un número entero entre 0 y 240.",
        lead: leadError,
        horizon: !(Number.isInteger(horizon) && horizon >= 1 && horizon <= 365) ? "Escribe un número entero entre 1 y 365."
            : !leadError && leadMinutes >= horizon * 24 * 60 ? "Debe ser mayor que la anticipación mínima, o no habrá horarios disponibles."
            : null,
        reschedules: Number.isInteger(reschedules) && reschedules >= 0 && reschedules <= MAX_PATIENT_RESCHEDULES
            ? null : `Escribe un número entero entre 0 y ${MAX_PATIENT_RESCHEDULES}.`,
        notice: Number.isInteger(notice) && notice >= 0 && notice <= MAX_RESCHEDULE_NOTICE_HOURS
            ? null : `Escribe un número entero entre 0 y ${MAX_RESCHEDULE_NOTICE_HOURS} horas (7 días).`,
    };
    const body = {
        slotIntervalMinutes: form.interval,
        bufferMinutes: buffer,
        minLeadMinutes: leadMinutes,
        maxHorizonDays: horizon,
        maxPatientReschedules: reschedules,
        minRescheduleNoticeHours: notice,
        portalReminderTiming: form.reminderTiming,
    } satisfies BookingSettingsUpdate;
    return { body, errors, invalid: Object.values(errors).some(Boolean) };
}

export function RulesSection({ settings, save, onSaved }: { settings: BookingSettings; save: SaveFn; onSaved: (s: BookingSettings) => void }) {
    const selfServeEnabled = !!useAuthContext().user?.selfServeEnabled;
    const [ form, setForm ] = useState<RulesForm>(() => rulesFormOf(settings));
    const [ initial ] = useState(() => parseRules(rulesFormOf(settings)).body);
    const autosave = useDebouncedSave<BookingSettingsUpdate>(async (body) => onSaved(await save(body)), { initial });
    const { errors, invalid } = parseRules(form);
    const ids = useId();
    const { appointmentTypes } = useFetchAppointmentTypes();
    const gapWarning = intervalGapWarning(
        form.interval,
        toNumber(form.buffer),
        appointmentTypes.filter((t) => t.bookableOnline && t.isActive !== false).map((t) => t.defaultDuration),
    );

    function change(patch: Partial<RulesForm>) {
        const next = { ...form, ...patch };
        setForm(next);
        const parsed = parseRules(next);
        if (parsed.invalid) autosave.cancel();
        else autosave.schedule(parsed.body);
    }

    function numberField(props: {
        field: keyof typeof errors; label: string; hint: string;
        min: number; max: number; step?: number; testId: string;
    }) {
        const err = errors[ props.field ];
        const errId = `${ids}-${props.field}-error`;
        return (
            <label className="form-label">
                {props.label}
                <input
                    className="form-input"
                    type="number"
                    inputMode="decimal"
                    min={props.min}
                    max={props.max}
                    step={props.step}
                    value={form[ props.field ]}
                    onChange={(e) => change({ [ props.field ]: e.target.value } as Partial<RulesForm>)}
                    aria-invalid={!!err}
                    aria-describedby={err ? errId : undefined}
                    data-testid={props.testId}
                />
                {err ? <FieldError id={errId} message={err} /> : <span className="form-input-hint">{props.hint}</span>}
            </label>
        );
    }

    return (
        <SettingsSection title="Reglas de reserva" status={<SaveStatusIndicator saving={autosave.saving} status={autosave.status} error={autosave.error} testId="online-booking-rules-save-state" />}>
            <div className="form-stack">
                <div className="form-grid-2">
                    <label className="form-label" data-testid="online-booking-interval">
                        Intervalo entre horarios (min)
                        <CustomSelect
                            value={String(form.interval)}
                            onChange={(v) => change({ interval: Number(v) })}
                            options={SLOT_INTERVAL_OPTIONS.map((n) => ({ value: String(n), label: `${n} min` }))}
                        />
                        <span className="form-input-hint">Cada cuánto se ofrece un horario de inicio. La duración la define el tipo de cita.</span>
                        {gapWarning && <WarningHint testId="online-booking-interval-warning">{gapWarning}</WarningHint>}
                    </label>
                    {numberField({
                        field: "buffer", label: "Tiempo entre citas (min)", hint: "Margen libre antes y después de cada cita reservada en línea.",
                        min: 0, max: 240, testId: "online-booking-buffer",
                    })}
                    {numberField({
                        field: "lead", label: "Anticipación mínima (horas)", hint: "Con cuánto tiempo de antelación se puede reservar.",
                        min: 0, max: 336, step: 0.5, testId: "online-booking-lead",
                    })}
                    {numberField({
                        field: "horizon", label: "Reservar hasta (días)", hint: "Cuántos días hacia adelante se puede reservar, contando hoy.",
                        min: 1, max: 365, testId: "online-booking-horizon",
                    })}
                </div>
                {selfServeEnabled && <fieldset className="form-stack form-fieldset-plain">
                    <legend className="form-label form-fieldset-legend">Reprogramación por pacientes</legend>
                    <div className="form-grid-2">
                        {numberField({
                            field: "reschedules", label: "Reprogramaciones por cita",
                            hint: "Cuántas veces un paciente puede mover en línea una cita que reservó. Con 0 no puede reprogramar; siempre puede cancelar.",
                            min: 0, max: MAX_PATIENT_RESCHEDULES, step: 1, testId: "online-booking-max-reschedules",
                        })}
                        {numberField({
                            field: "notice", label: "Aviso mínimo para reprogramar (horas)",
                            hint: "Después de este momento antes de la cita, el paciente ya no puede reprogramarla en línea.",
                            min: 0, max: MAX_RESCHEDULE_NOTICE_HOURS, step: 1, testId: "online-booking-reschedule-notice",
                        })}
                    </div>
                </fieldset>}
                <fieldset className="form-stack form-fieldset-plain">
                    <legend className="form-label form-fieldset-legend">Recordatorio al paciente</legend>
                    <div className="form-grid-2">
                        <label className="form-label" data-testid="online-booking-reminder-timing">
                            Enviar recordatorio
                            <CustomSelect
                                value={form.reminderTiming}
                                onChange={(v) => change({ reminderTiming: v as PortalReminderTiming })}
                                options={PORTAL_REMINDER_TIMINGS.map(({ value, type }) => ({ value, label: REMINDER_TYPE_CONFIG[ type ].label }))}
                            />
                            <span className="form-input-hint">{reminderTimingHint(form.reminderTiming)}</span>
                        </label>
                    </div>
                </fieldset>
                {invalid && (
                    <WarningHint testId="online-booking-rules-unsaved">Corrige los campos marcados para guardar los cambios.</WarningHint>
                )}
                {autosave.error && <InlineError message={autosave.error} />}
            </div>
        </SettingsSection>
    );
}
