"use client";

import { useCreateAppointment } from "@/src/api/useCreateAppointment";
import { useCreateReminder } from "@/src/api/useCreateReminder";
import { useUpdateAppointment } from "@/src/api/useUpdateAppointment";
import { useUpdateReminder } from "@/src/api/useUpdateReminder";
import { useFetchAppointments } from "@/src/api/useFetchAppointments";
import { useFetchPatients } from "@/src/api/useFetchPatients";
import { useFetchAppointmentTypes } from "@/src/api/useFetchAppointmentTypes";
import { useFetchLocations } from "@/src/api/useFetchLocations";
import { Appointment, AppointmentForm, AppointmentStatus, AppointmentDuration, AppointmentPaidStatus } from "@/src/types/Appointment";
import { ReminderType, Reminder, ReminderMode, ReminderStatus, Channel } from "@/src/types/Reminder";
import { getUserName } from "@/src/utils/AvatarHelper";
import { fmtDate, fmtTime, getDuration, getRemindersendAt, getAppointmentEndTime, getTomorrowSixAm, getReminderType, getDate } from "@/src/utils/TimeUtils";
import { TWILIO_CONFIG } from "@/src/utils/twilioConfig";
import { useAuthContext } from "@/src/app/AuthContext";
import { LBL_SAVE_CHANGES, LBL_CREATE_APPOINTMENT, LBL_SAVING, LBL_BACK } from "@/src/constants/ui";
import { useState } from "react";
import { useFocusTrap } from "@/src/hooks/useFocusTrap";
import { PatientAndTypeStep } from "./PatientAndTypeStep";
import { LocationAndTimeStep } from "./LocationAndTimeStep";
import { PaymentAndStatusStep } from "./PaymentAndStatusStep";

export function AppointmentModal({ appt, prefillDate, onClose, onSaved }: {
    appt?: Appointment;
    prefillDate?: string | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const isEdit = !!appt;
    const { user } = useAuthContext();
    const { ref: trapRef, handleKeyDown: trapKeyDown } = useFocusTrap<HTMLDivElement>();
    const { patients } = useFetchPatients();
    const { appointments } = useFetchAppointments();
    const { createAppointment } = useCreateAppointment();
    const { updateAppointment } = useUpdateAppointment();
    const { createReminder } = useCreateReminder();
    const { updateReminder } = useUpdateReminder();
    const { locations } = useFetchLocations();
    const { appointmentTypes } = useFetchAppointmentTypes();

    const [ step, setStep ] = useState(1);
    const [ saving, setSaving ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const [ reminderChannel, setReminderChannel ] = useState<Channel>(Channel.WHATSAPP);

    const [ form, setForm ] = useState<AppointmentForm>({
        patientId: appt?.patient.id ?? "",
        startAt: appt?.startAt ?? prefillDate ?? getTomorrowSixAm(),
        status: appt?.status ?? AppointmentStatus.SCHEDULED,
        typeId: appt?.appointmentType.id ?? "",
        locationId: appt?.appointmentLocation.id ?? "",
        meetingUrl: appt?.meetingUrl ?? undefined,
        price: appt?.price ?? 0,
        paid: appt?.paid ? AppointmentPaidStatus.PAID : AppointmentPaidStatus.UNPAID,
        duration: getDuration(appt?.startAt, appt?.endAt) ?? AppointmentDuration.MIN_60,
        reminderType: appt?.reminder ? getReminderType(appt.startAt, appt.reminder.sendAt) : ReminderType.NONE,
        notes: appt?.notes ?? undefined,
    });

    const set = (field: keyof AppointmentForm) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
            setForm(f => ({ ...f, [ field ]: e.target.value }));

    const selectedPatient = patients.find(p => p.id === form.patientId);

    const selectedChannelAvailable = reminderChannel === Channel.WHATSAPP ? !!selectedPatient?.whatsappNumber
        : reminderChannel === Channel.SMS ? !!selectedPatient?.smsNumber
            : !!selectedPatient?.email;

    const isValid = step === 1
        ? !!form.patientId && !!form.typeId && !!form.startAt
        : step === 2
            ? !!form.locationId && (form.reminderType !== ReminderType.NONE ? selectedChannelAvailable : true)
            : !!form.price;

    function buildReminderPayload(): Partial<Reminder> {
        const to = reminderChannel === Channel.WHATSAPP
            ? selectedPatient?.whatsappNumber || ""
            : reminderChannel === Channel.SMS
                ? selectedPatient?.smsNumber || ""
                : selectedPatient?.email || "";

        return {
            to,
            contentSid: TWILIO_CONFIG.PATIENT_APPOINTMENT_REMINDER_CONFIRMATION.contentSid,
            contentVariables: {
                "1": selectedPatient ? `${selectedPatient.name}` : "",
                "2": getUserName(user) || "su profesional de salud",
                "3": getDate(form.startAt),
                "4": fmtTime(form.startAt),
            },
            body: TWILIO_CONFIG.PATIENT_APPOINTMENT_REMINDER_CONFIRMATION.template
                .replace("{{1}}", selectedPatient ? `${selectedPatient.name}` : "")
                .replace("{{2}}", getUserName(user) || "su profesional de salud")
                .replace("{{3}}", fmtDate(form.startAt))
                .replace("{{4}}", fmtTime(form.startAt)),
            patientId: form.patientId,
            channel: reminderChannel,
            sendMode: ReminderMode.SCHEDULED,
            status: ReminderStatus.PENDING,
            sendAt: getRemindersendAt(form.startAt, form.reminderType),
        };
    }

    function buildAppointmentPayload(): Partial<Appointment> {
        return {
            ...form,
            endAt: getAppointmentEndTime(form.startAt, form.duration as AppointmentDuration),
            paid: form.paid === AppointmentPaidStatus.PAID,
        };
    }

    async function handleSubmit() {
        setSaving(true); setError(null);
        try {
            if (isEdit) {
                if (appt!.reminder) {
                    if (form.reminderType === ReminderType.NONE) {
                        await updateReminder(appt!.reminder.id, { status: ReminderStatus.CANCELLED });
                    } else {
                        await updateReminder(appt!.reminder.id, buildReminderPayload());
                    }
                } else if (form.reminderType !== ReminderType.NONE) {
                    const reminder = await createReminder(buildReminderPayload());
                    setForm(f => ({ ...f, reminderId: reminder.id }));
                }
                await updateAppointment(appt!.id, buildAppointmentPayload());
            } else {
                if (form.reminderType !== ReminderType.NONE) {
                    const reminder = await createReminder(buildReminderPayload());
                    setForm(f => ({ ...f, reminderId: reminder.id }));
                }
                await createAppointment(buildAppointmentPayload());
            }
            onSaved(); onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        } finally { setSaving(false); }
    }

    const bookedSlots = appointments.filter(a => a.id !== appt?.id).map(a => a.startAt);
    const steps = [ "Paciente & Tipo", "Lugar & Hora", "Pago & Estado" ];

    return (
        <div className="modal-overlay modal-overlay--nested" onClick={onClose} role="dialog" aria-modal="true" aria-label={isEdit ? "Editar Cita" : "Nueva Cita"} ref={trapRef} onKeyDown={trapKeyDown}>
            <div className="modal-panel modal-panel--lg slide-up" onClick={e => e.stopPropagation()}>
                <div className="modal-header modal-header--top">
                    <div>
                        <h2 className="modal-title">{isEdit ? "Editar Cita" : "Nueva Cita"}</h2>
                        <p className="modal-subtitle">{steps[ step - 1 ]} — Paso {step} de {steps.length}</p>
                    </div>
                    <button onClick={onClose} className="btn-close">✕</button>
                </div>
                <div className="step-bar">
                    {steps.map((_, i) => (
                        <div key={i} className={`step-bar__segment ${i < step ? "step-bar__segment--done" : ""}`} />
                    ))}
                </div>
                {error && <div className="error-inline">⚠️ {error}</div>}
                {step === 1 && (
                    <PatientAndTypeStep
                        form={form} setForm={setForm} patients={patients}
                        isEdit={isEdit} selectedPatient={selectedPatient}
                        appointmentTypes={appointmentTypes} bookedSlots={bookedSlots}
                    />
                )}
                {step === 2 && (
                    <LocationAndTimeStep
                        form={form} set={set} setForm={setForm}
                        selectedPatient={selectedPatient} reminderChannel={reminderChannel}
                        setReminderChannel={setReminderChannel} locations={locations}
                    />
                )}
                {step === 3 && (
                    <PaymentAndStatusStep
                        form={form} set={set} setForm={setForm}
                        selectedPatient={selectedPatient} locations={locations}
                        appointmentTypes={appointmentTypes}
                    />
                )}
                <div className="modal-footer">
                    {step > 1 && (
                        <button onClick={() => setStep(s => s - 1)} className="btn-secondary" disabled={saving}>
                            {LBL_BACK}
                        </button>
                    )}
                    {step < steps.length
                        ? <button onClick={() => { setError(null); setStep(s => s + 1); }} disabled={!isValid} className="btn-primary">Continuar →</button>
                        : <button onClick={handleSubmit} disabled={saving || !isValid} className="btn-primary">
                            {saving ? LBL_SAVING : isEdit ? LBL_SAVE_CHANGES : LBL_CREATE_APPOINTMENT}
                        </button>
                    }
                </div>
            </div>
        </div>
    );
}
