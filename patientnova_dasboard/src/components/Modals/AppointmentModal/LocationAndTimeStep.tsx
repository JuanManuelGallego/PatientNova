"use client";

import { AppointmentForm, AppointmentDuration, AppointmentLocation } from "@/src/types/Appointment";
import { ReminderType, Channel, CHANNEL_CFG } from "@/src/types/Reminder";
import { Patient } from "@/src/types/Patient";
import { isReminderTypeFeasible } from "@/src/utils/TimeUtils";
import { CustomSelect } from "@/src/components/CustomSelect";
import { RequiredField } from "@/src/components/Info/Required";
import { LBL_NO_REMINDER } from "@/src/constants/ui";
import React from "react";
import { SetField } from "./types";

interface Props {
    form: AppointmentForm;
    set: SetField;
    setForm: React.Dispatch<React.SetStateAction<AppointmentForm>>;
    selectedPatient: Patient | undefined;
    reminderChannel: Channel;
    setReminderChannel: (c: Channel) => void;
    locations: AppointmentLocation[];
}

export function LocationAndTimeStep({ form, set, setForm, selectedPatient, reminderChannel, setReminderChannel, locations }: Props) {
    const setField = (field: keyof AppointmentForm) => (value: string) => setForm(f => ({ ...f, [ field ]: value }));

    return (
        <div className="form-stack">
            <label className="form-label">
                <RequiredField label="Duración" />
                <CustomSelect
                    value={form.duration}
                    options={Object.values(AppointmentDuration).map(d => ({ value: d, label: d }))}
                    onChange={setField("duration")}
                />
            </label>

            <label className="form-label">
                <RequiredField label="Ubicación" />
                <CustomSelect
                    value={form.locationId}
                    placeholder="Seleccionar ubicación…"
                    options={locations.map(d => ({ value: d.id, label: d.name }))}
                    onChange={setField("locationId")}
                />
            </label>

            {locations.find(l => l.id === form.locationId)?.isVirtual && (
                <label className="form-label">
                    URL de videollamada
                    <input type="url" className="form-input" value={form.meetingUrl} onChange={set("meetingUrl")} placeholder="https://meet.example.com/sala" />
                </label>
            )}

            {selectedPatient?.whatsappNumber || selectedPatient?.email || selectedPatient?.smsNumber ? (
                <div>
                    <label className="form-label">
                        Recordatorio
                        <CustomSelect
                            value={form.reminderType}
                            options={[
                                { value: ReminderType.NONE, label: LBL_NO_REMINDER },
                                { value: ReminderType.ONE_HOUR_BEFORE, label: "1 hora antes", disabled: !isReminderTypeFeasible(form.startAt, ReminderType.ONE_HOUR_BEFORE) },
                                { value: ReminderType.ONE_DAY_BEFORE, label: "1 día antes", disabled: !isReminderTypeFeasible(form.startAt, ReminderType.ONE_DAY_BEFORE) },
                                { value: ReminderType.ONE_WEEK_BEFORE, label: "1 semana antes", disabled: !isReminderTypeFeasible(form.startAt, ReminderType.ONE_WEEK_BEFORE) },
                            ]}
                            onChange={setField("reminderType")}
                        />
                    </label>

                    {form.reminderType !== ReminderType.NONE && (
                        <div>
                            <div className="channel-section-label">Canal de notificación</div>
                            <div style={{ display: "flex", gap: 10 }}>
                                {Object.values(Channel).map(c => {
                                    const available = (c === Channel.WHATSAPP && !!selectedPatient?.whatsappNumber) || (c === Channel.SMS && !!selectedPatient?.smsNumber);
                                    return (
                                        <button
                                            key={c}
                                            onClick={() => available && setReminderChannel(c)}
                                            className={`selection-card${reminderChannel === c ? " selection-card--active" : ""}${!available ? " selection-card--disabled" : ""}`}
                                            style={{ flex: 1 }}
                                        >
                                            <span style={{ fontSize: 22 }}>{CHANNEL_CFG[ c ].icon}</span>
                                            <div style={{ textAlign: "left" }}>
                                                <div className="patient-preview__name">{CHANNEL_CFG[ c ].label}</div>
                                                <div className="patient-preview__detail">
                                                    {available
                                                        ? (c === Channel.WHATSAPP ? selectedPatient?.whatsappNumber : c === Channel.SMS ? selectedPatient?.smsNumber : selectedPatient?.email)
                                                        : "No disponible"}
                                                </div>
                                            </div>
                                            {reminderChannel === c && available && <span style={{ marginLeft: "auto", color: "var(--c-brand)" }}>✓</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div>
                    <label className="form-label">Recordatorio</label>
                    <div className="error-inline">
                        ⚠️ El paciente no tiene forma de contacto registrada, por lo que no se podrán enviar recordatorios automáticos.
                    </div>
                </div>
            )}
        </div>
    );
}
