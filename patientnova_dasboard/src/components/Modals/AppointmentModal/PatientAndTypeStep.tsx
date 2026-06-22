"use client";

import { AppointmentForm, AppointmentDuration, AppointmentType } from "@/src/types/Appointment";
import { Patient } from "@/src/types/Patient";
import { getAvatarColor, getInitials, getPatientFullName } from "@/src/utils/AvatarHelper";
import { AppointmentDateTimePicker } from "@/src/components/AppointmentDateTimePicker";
import { CustomSelect } from "@/src/components/CustomSelect";
import { RequiredField } from "@/src/components/Info/Required";
import { LBL_NO_PATIENTS } from "@/src/constants/ui";
import React from "react";
import { STATUS_ICONS } from "@/src/config/icons";

interface Props {
    form: AppointmentForm;
    setForm: React.Dispatch<React.SetStateAction<AppointmentForm>>;
    patients: Patient[];
    isEdit: boolean;
    selectedPatient: Patient | undefined;
    appointmentTypes: AppointmentType[];
    bookedSlots: string[];
    onError: (error: string) => void;
    clearError: () => void;
}

export function PatientAndTypeStep({ form, setForm, patients, isEdit, selectedPatient, appointmentTypes, bookedSlots, onError, clearError }: Props) {
    return (
        <div className="form-stack">
            {!isEdit && (
                <label className="form-label">
                    <RequiredField label="Paciente" />
                    <CustomSelect
                        value={form.patientId}
                        placeholder="Seleccionar paciente…"
                        options={patients.length > 0
                            ? patients.filter(p => p.status === "ACTIVE").map(p => ({ value: p.id, label: getPatientFullName(p) }))
                            : [ { value: "", label: LBL_NO_PATIENTS } ]}
                        onChange={(v) => {
                            const typeId = patients.find(p => p.id === v)?.appointmentTypeId ?? '';
                            setForm(f => ({ ...f, patientId: v, typeId }))
                        }}
                    />
                </label>
            )}

            {selectedPatient && (
                <div className="patient-preview">
                    <div className="patient-preview__avatar" style={{ background: getAvatarColor(selectedPatient.id) }}>
                        {getInitials(selectedPatient.name, selectedPatient.lastName)}
                    </div>
                    <div>
                        <div className="patient-preview__name">{selectedPatient.name} {selectedPatient.lastName}</div>
                        <div className="patient-preview__detail">{selectedPatient.email}</div>
                    </div>
                </div>
            )}

            <label className="form-label">
                <RequiredField label="Fecha y Hora" />
                <AppointmentDateTimePicker
                    date={form.startAt}
                    onChanged={(date) => { setForm(f => ({ ...f, startAt: date })); clearError() }}
                    onError={onError}
                    bookedSlots={bookedSlots}
                />
            </label>

            <label className="form-label">
                <RequiredField label="Tipo de cita" />
                {appointmentTypes.length > 0 ? (
                    <CustomSelect
                        value={form.typeId}
                        placeholder="Seleccionar tipo…"
                        options={appointmentTypes.map(t => ({ value: t.id, label: t.name }))}
                        onChange={(v) => setForm(f => ({
                            ...f,
                            typeId: v,
                            price: appointmentTypes.find(t => t.id === v)?.defaultPrice ?? 0,
                            duration: AppointmentDuration.MIN_60,
                        }))}
                    />
                ) : (
                    <div className="error-inline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <STATUS_ICONS.warning size={14} /> No hay tipos de cita disponibles.
                    </div>
                )}
            </label>
        </div>
    );
}
