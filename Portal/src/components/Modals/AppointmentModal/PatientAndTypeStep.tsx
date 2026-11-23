"use client";

import { AppointmentForm, AppointmentDuration, AppointmentType } from "@/src/types/Appointment";
import { Patient } from "@/src/types/Patient";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import { AppointmentDateTimePicker, type BusyInterval } from "@/src/components/AppointmentDateTimePicker";
import { appointmentDurationMinutes } from "@/src/utils/TimeUtils";
import { PatientAutocomplete } from "@/src/components/PatientAutocomplete";
import { CustomSelect } from "@/src/components/CustomSelect";
import { RequiredField } from "@/src/components/Info/Required";
import React from "react";
import { STATUS_ICONS } from "@/src/config/icons";

interface Props {
    form: AppointmentForm;
    setForm: React.Dispatch<React.SetStateAction<AppointmentForm>>;
    isEdit: boolean;
    selectedPatient: Patient | undefined;
    appointmentTypes: AppointmentType[];
    bookedSlots: BusyInterval[];
    blockedSlots: BusyInterval[];
    clearError: () => void;
    onPatientSelect: (patient: Patient | undefined) => void;
}

export function PatientAndTypeStep({ form, setForm, isEdit, selectedPatient, appointmentTypes, bookedSlots, blockedSlots, clearError, onPatientSelect }: Props) {
    return (
        <div className="form-stack">
            {!isEdit && (
                <label className="form-label">
                    <RequiredField label="Paciente" />
                    <PatientAutocomplete
                        value={form.patientId}
                        placeholder="Seleccionar paciente…"
                        data-testid="appointment-patient-autocomplete"
                        onChange={(v, patient) => {
                            const type = appointmentTypes.find(t => t.id === patient?.appointmentTypeId);
                            setForm(f => ({ ...f, patientId: v, typeId: type?.id ?? '', price: type?.defaultPrice ?? 0 }));
                            onPatientSelect(patient);
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

            <AppointmentDateTimePicker
                label={<RequiredField label="Fecha y hora" />}
                date={form.startAt}
                onChange={(date) => { setForm(f => ({ ...f, startAt: date })); clearError() }}
                bookedSlots={bookedSlots}
                blockedSlots={blockedSlots}
                duration={appointmentDurationMinutes(form.duration as AppointmentDuration)}
            />

            <label className="form-label">
                <RequiredField label="Tipo de cita" />
                {appointmentTypes.length > 0 ? (
                    <CustomSelect
                        value={form.typeId}
                        placeholder="Seleccionar tipo…"
                        data-testid="appointment-type-select"
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
