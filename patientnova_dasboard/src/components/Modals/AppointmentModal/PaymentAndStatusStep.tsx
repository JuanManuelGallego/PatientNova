"use client";

import { AppointmentForm, AppointmentStatus, AppointmentPaidStatus, APPT_STATUS_CFG, APPT_PAID_STATUS_CFG, AppointmentLocation, AppointmentType } from "@/src/types/Appointment";
import { ReminderType, REMINDER_TYPE_CONFIG } from "@/src/types/Reminder";
import { Patient } from "@/src/types/Patient";
import { fmtDate, fmtTime } from "@/src/utils/TimeUtils";
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
    locations: AppointmentLocation[];
    appointmentTypes: AppointmentType[];
}

export function PaymentAndStatusStep({ form, set, setForm, selectedPatient, locations, appointmentTypes }: Props) {
    const setField = (field: keyof AppointmentForm) => (value: string) => setForm(f => ({ ...f, [ field ]: value }));

    return (
        <div className="form-stack">
            <div className="form-grid-2">
                <label className="form-label">
                    <RequiredField label="Precio" />
                    <div className="input-prefix">
                        <span className="input-prefix__symbol">$</span>
                        <input type="number" step="0.01" className="form-input" value={form.price} onChange={set("price")} placeholder="150.00" />
                    </div>
                </label>
                <label className="form-label">
                    Pago
                    <CustomSelect
                        value={form.paid}
                        options={(Object.keys(APPT_PAID_STATUS_CFG) as AppointmentPaidStatus[]).map(s => ({ value: s, label: `${APPT_PAID_STATUS_CFG[ s ].icon} ${APPT_PAID_STATUS_CFG[ s ].label}` }))}
                        onChange={setField("paid")}
                    />
                </label>
                <label className="form-label">
                    Estado
                    <CustomSelect
                        value={form.status}
                        options={(Object.keys(APPT_STATUS_CFG) as AppointmentStatus[]).map(s => ({ value: s, label: `${APPT_STATUS_CFG[ s ].icon} ${APPT_STATUS_CFG[ s ].label}` }))}
                        onChange={setField("status")}
                    />
                </label>
            </div>

            <div className="summary-card">
                <div className="summary-card__label">Resumen</div>
                {[
                    [ "Paciente", selectedPatient ? `${selectedPatient.name} ${selectedPatient.lastName}` : "—" ],
                    [ "Tipo", appointmentTypes.find(t => t.id === form.typeId)?.name || "—" ],
                    [ "Fecha", `${fmtDate(form.startAt)} a las ${fmtTime(form.startAt)}` ],
                    [ "Duración", form.duration ],
                    [ "Ubicación", locations.find(l => l.id === form.locationId)?.name || "—" ],
                    [ "Precio", `$${form.price}` ],
                    [ "Recordatorio", form.reminderType !== ReminderType.NONE ? REMINDER_TYPE_CONFIG[ form.reminderType ].label : LBL_NO_REMINDER ],
                ].map(([ k, v ]) => (
                    <div key={k} className="summary-row">
                        <span className="summary-row__key">{k}</span>
                        <span className="summary-row__value">{v}</span>
                    </div>
                ))}
            </div>

            <div>
                <label className="form-label">
                    Notas
                    <input className="form-input" onChange={set("notes")} />
                </label>
            </div>
        </div>
    );
}
