"use client";

import { useId, useState } from "react";
import { BookingApprovalMode, BookingSettings } from "@/src/types/Booking";
import { SaveStatusIndicator } from "@/src/components/Info/SaveStatusIndicator";
import { InlineError } from "@/src/components/Info/InlineError";
import { useDebouncedSave } from "@/src/hooks/useDebouncedSave";
import { type SaveFn } from "./shared";
import { SettingsSection } from "../SettingsSection";

const APPROVAL_OPTIONS: { value: BookingApprovalMode; label: string; hint: string }[] = [
    {
        value: "AUTO_CONFIRM",
        label: "Confirmar automáticamente",
        hint: "La cita queda confirmada en cuanto el paciente reserva.",
    },
    {
        value: "REQUIRE_APPROVAL",
        label: "Revisar cada solicitud",
        hint: "El paciente envía una solicitud que reserva el horario hasta 48 horas. Tú la apruebas o la rechazas en Solicitudes.",
    },
];

export function ApprovalSection({ settings, save, onSaved }: { settings: BookingSettings; save: SaveFn; onSaved: (s: BookingSettings) => void }) {
    const [ mode, setMode ] = useState<BookingApprovalMode>(settings.bookingApprovalMode);
    const autosave = useDebouncedSave<BookingApprovalMode>(
        async (bookingApprovalMode) => onSaved(await save({ bookingApprovalMode })),
        { initial: settings.bookingApprovalMode },
    );
    const name = useId();

    function handleChange(next: BookingApprovalMode) {
        setMode(next);
        autosave.schedule(next);
    }

    return (
        <SettingsSection title="Confirmación de reservas" status={<SaveStatusIndicator saving={autosave.saving} status={autosave.status} error={autosave.error} testId="online-booking-approval-save-state" />} testId="online-booking-approval">
            <div className="form-stack">
                <fieldset className="form-stack form-fieldset-plain">
                    <legend className="sr-only">Cómo se confirman las reservas en línea</legend>
                    {APPROVAL_OPTIONS.map((opt) => (
                        <label key={opt.value} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                            <input
                                type="radio"
                                name={name}
                                value={opt.value}
                                checked={mode === opt.value}
                                onChange={() => handleChange(opt.value)}
                                style={{ marginTop: 3 }}
                                data-testid={`online-booking-approval-${opt.value.toLowerCase().replace("_", "-")}`}
                            />
                            <span>
                                <span style={{ fontWeight: 600, color: "var(--c-gray-900)" }}>{opt.label}</span>
                                <span className="form-input-hint" style={{ display: "block" }}>{opt.hint}</span>
                            </span>
                        </label>
                    ))}
                </fieldset>
                {settings.bookingApprovalMode === "REQUIRE_APPROVAL" && (
                    <span className="form-input-hint">
                        Si vuelves a la confirmación automática, las solicitudes pendientes siguen esperando tu respuesta.
                    </span>
                )}
                {autosave.error && <InlineError message={autosave.error} />}
            </div>
        </SettingsSection>
    );
}
