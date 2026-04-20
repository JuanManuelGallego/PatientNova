"use client";

import { useEffect, useRef, useState } from "react";
import { useCreateAppointmentType } from "@/src/api/useCreateAppointmentType";
import { useUpdateAppointmentType } from "@/src/api/useUpdateAppointmentType";
import { AppointmentType } from "@/src/types/Appointment";
import { RequiredField } from "@/src/components/Info/Required";
import { LBL_CANCEL, LBL_CREATE_APPT_TYPE, LBL_SAVE, LBL_SAVING, ERR_SAVE } from "@/src/constants/ui";

type AppointmentTypeForm = {
    name: string;
    description: string;
    defaultDuration: number;
    defaultPrice: number;
    color: string;
};

export function AppointmentTypeModal({
    onClose,
    onSaved,
    appointmentType,
}: {
    onClose: () => void;
    onSaved: () => void;
    appointmentType?: AppointmentType | null;
}) {
    const isEdit = !!appointmentType;
    const { createAppointmentType } = useCreateAppointmentType();
    const { updateAppointmentType } = useUpdateAppointmentType();
    const [ saving, setSaving ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const firstInputRef = useRef<HTMLInputElement>(null);

    const [ form, setForm ] = useState<AppointmentTypeForm>({
        name: appointmentType?.name ?? "",
        description: appointmentType?.description ?? "",
        defaultDuration: appointmentType?.defaultDuration ?? 60,
        defaultPrice: appointmentType?.defaultPrice ?? 0,
        color: appointmentType?.color ?? "#7C3AED",
    });

    useEffect(() => {
        setTimeout(() => firstInputRef.current?.focus(), 50);
    }, []);

    const setField = (field: keyof AppointmentTypeForm) =>
        (e: React.ChangeEvent<HTMLInputElement>) =>
            setForm(f => ({ ...f, [ field ]: e.target.value }));

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const data = {
                name: form.name.trim(),
                description: form.description.trim() || null,
                defaultDuration: form.defaultDuration,
                defaultPrice: form.defaultPrice || null,
                color: form.color,
            };
            if (isEdit) {
                await updateAppointmentType(appointmentType!.id, data);
            } else {
                await createAppointmentType(data);
            }
            onSaved();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : ERR_SAVE);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-panel modal-panel--sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">
                            {isEdit ? "Editar tipo de cita" : "Nuevo tipo de cita"}
                        </h2>
                        <p className="modal-subtitle">
                            {isEdit
                                ? `Modificando: ${appointmentType!.name}`
                                : "Configura un nuevo tipo de cita"}
                        </p>
                    </div>
                    <button onClick={onClose} className="btn-close">✕</button>
                </div>

                {error && <div className="error-inline">⚠️ {error}</div>}

                <form className="form-stack" onSubmit={handleSubmit}>
                    <div className="form-grid-2">
                        <label className="form-label">
                            <RequiredField label="Nombre" />
                            <input
                                ref={firstInputRef}
                                className="form-input"
                                value={form.name}
                                onChange={setField("name")}
                                placeholder="Individual"
                                required
                            />
                        </label>
                        <label className="form-label">
                            Duración por defecto (min)
                            <input
                                className="form-input"
                                type="number"
                                min={1}
                                value={form.defaultDuration}
                                onChange={e => setForm(f => ({ ...f, defaultDuration: Number(e.target.value) }))}
                            />
                        </label>
                    </div>

                    <label className="form-label">
                        Descripción
                        <input
                            className="form-input"
                            value={form.description}
                            onChange={setField("description")}
                            placeholder="Sesión individual de terapia"
                        />
                    </label>

                    <div className="form-grid-2">
                        <label className="form-label">
                            Precio por defecto
                            <div className="input-prefix">
                                <span className="input-prefix__symbol">$</span>
                                <input
                                    className="form-input"
                                    type="number"
                                    min={0}
                                    value={form.defaultPrice}
                                    onChange={e => setForm(f => ({ ...f, defaultPrice: Number(e.target.value) }))}
                                />
                            </div>
                        </label>
                        <label className="form-label">
                            Color
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <input
                                    className="form-input"
                                    type="color"
                                    value={form.color}
                                    onChange={setField("color")}
                                    style={{ width: 52, height: 36, padding: 3, cursor: "pointer" }}
                                />
                            </div>
                        </label>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
                            {LBL_CANCEL}
                        </button>
                        <button type="submit" className="btn-primary btn-hero" disabled={saving || !form.name.trim()}>
                            {saving ? LBL_SAVING : isEdit ? LBL_SAVE : LBL_CREATE_APPT_TYPE}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
