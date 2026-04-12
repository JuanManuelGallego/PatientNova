import { useCreateReminder } from "@/src/api/useCreateReminder";
import { useNotify } from "@/src/api/useNotify";
import { Patient } from "@/src/types/Patient";
import { Reminder, ReminderMode, Channel, ReminderForm, CHANNEL_CFG } from "@/src/types/Reminder";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import { fmtDateTime } from "@/src/utils/TimeUtils";
import { useState } from "react";
import { DateTimePicker } from "../DateTimePicker";
import { CustomSelect } from "../CustomSelect";
import { RequiredField } from "../Info/Requiered";
import { useFetchPatients } from "@/src/api/useFetchPatients";
import { useFetchAppointmentTypes } from "@/src/api/useFetchAppointmentTypes";

export function ReminderModal({
    onClose, onSaved, reminder,
}: {
    onClose: () => void;
    onSaved: () => void;
    reminder?: Reminder;
}) {
    const isEdit = !!reminder;
    const { createReminder } = useCreateReminder();
    const { notify } = useNotify();
    const { patients } = useFetchPatients();

    const [ step, setStep ] = useState(1);
    const [ sendMode, setMode ] = useState<ReminderMode>(ReminderMode.IMMEDIATE);
    const [ saving, setSaving ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const [ form, setForm ] = useState<ReminderForm>({
        patientId: "",
        channel: Channel.WHATSAPP,
        message: "",
        sendAt: "",
        appointmentType: undefined,
    });

    const isValid = step === 1
        ? !!form.patientId && !!form.appointmentType
        : step === 2 ? !!form.channel && !!form.message.trim() && (sendMode === ReminderMode.SCHEDULED ? !!form.sendAt : true) : true;

    const selectedPatient = patients.find(p => p.id === form.patientId);

    const set: SetField = (field) =>
        (e) =>
            setForm(f => ({ ...f, [ field ]: e.target.value }));

    function validateForm() {
        if (!selectedPatient) { setError("Selecciona un paciente"); return false; }
        if (!form.appointmentType) { setError("Selecciona un tipo de cita"); return false; }
        if (!form.channel) { setError("Selecciona un canal de notificación"); return false; }
        if (!form.message.trim()) { setError("El mensaje no puede estar vacío"); return false; }
        if (form.channel === Channel.WHATSAPP && !selectedPatient.whatsappNumber) {
            setError("El paciente no tiene número de WhatsApp"); return false;
        }
        if (form.channel === Channel.SMS && !selectedPatient.smsNumber) {
            setError("El paciente no tiene número de SMS"); return false;
        }
        if (sendMode === ReminderMode.SCHEDULED && !form.sendAt) {
            setError("Selecciona fecha y hora de envío"); return false;
        }
        setError(null);
        return true;
    }

    function buildPayload() {
        const to = form.channel === Channel.WHATSAPP
            ? selectedPatient!.whatsappNumber ?? ""
            : selectedPatient!.smsNumber ?? "";

        return {
            to,
            contentSid: "HX37ade446b4d27706eefce63ee11d1528",
            contentVariables: { "1": "12 de Abril", "2": "3:00 PM" },
            body: form.message,
            patientId: form.patientId,
        };
    }

    function buildScheduledPayload() {
        return {
            ...buildPayload(),
            channel: form.channel,
            sendMode: sendMode,
            sendAt: new Date(form.sendAt).toISOString(),
        };
    }

    async function handleSubmit() {
        if (!validateForm()) return;
        setSaving(true); setError(null);
        try {
            if (sendMode === ReminderMode.IMMEDIATE) {
                await notify(form.channel, buildPayload());
            } else {
                await createReminder(buildScheduledPayload());
            }
            onSaved(); onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setSaving(false);
        }
    }

    const totalSteps = 3;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-panel modal-panel--md slide-up" onClick={e => e.stopPropagation()}>
                <div className="modal-header modal-header--top">
                    <div>
                        <h2 className="modal-title">
                            {isEdit ? "Editar Recordatorio" : "Nuevo Recordatorio"}
                        </h2>
                        <p className="modal-subtitle">Paso {step} de {totalSteps}</p>
                    </div>
                    <button onClick={onClose} className="btn-close">✕</button>
                </div>
                <div className="step-bar">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                        <div key={i} className={`step-bar__segment ${i < step ? "step-bar__segment--done" : ""}`} />
                    ))}
                </div>
                {error && (
                    <div className="error-inline">⚠️ {error}</div>
                )}
                {step === 1 && <SendModeAndPatientStep sendMode={sendMode} setMode={setMode} form={form} setForm={setForm} patients={patients} />}
                {step === 2 && <ChannelAndMessageStep form={form} setForm={setForm} selectedPatient={selectedPatient} sendMode={sendMode} set={set} />}
                {step === 3 && <SummaryStep form={form} selectedPatient={selectedPatient} sendMode={sendMode} />}
                <div className="modal-footer">
                    {step > 1 && <button onClick={() => setStep(s => s - 1)} className="btn-secondary" disabled={saving}>Atrás</button>}
                    {step < totalSteps
                        ? <button onClick={() => { setError(null); setStep(s => s + 1); }} disabled={!isValid} className="btn-primary">Continuar →</button>
                        : <button onClick={handleSubmit} disabled={saving} className="btn-primary">
                            {saving ? "Enviando…" : sendMode === ReminderMode.IMMEDIATE ? "⚡ Enviar ahora" : "🗓️ Programar"}
                        </button>
                    }
                </div>
            </div>
        </div>
    );
}

type SetField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;

function SendModeAndPatientStep({ sendMode, setMode, form, setForm, patients }: {
    sendMode: ReminderMode;
    setMode: (m: ReminderMode) => void;
    form: ReminderForm;
    setForm: React.Dispatch<React.SetStateAction<ReminderForm>>;
    patients: Patient[];
}) {
    const { appointmentTypes } = useFetchAppointmentTypes();

    return (
        <div className="form-stack">
            <div>
                <div className="channel-section-label"><RequiredField label="Tipo de envío" /></div>
                <div className="form-grid-2">
                    {([
                        { key: ReminderMode.IMMEDIATE, icon: "⚡", title: "Enviar ahora", sub: "Se envía inmediatamente" },
                        { key: ReminderMode.SCHEDULED, icon: "🗓️", title: "Programar envío", sub: "Elegir fecha y hora" },
                    ] as const).map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => setMode(opt.key)}
                            className={`selection-card selection-card--column${sendMode === opt.key ? " selection-card--active" : ""}`}
                        >
                            <span style={{ fontSize: 22 }}>{opt.icon}</span>
                            <span className="patient-preview__name">{opt.title}</span>
                            <span className="patient-preview__detail">{opt.sub}</span>
                            {sendMode === opt.key && <span style={{ marginLeft: "auto", color: "var(--c-brand)", fontSize: 16, alignSelf: "flex-end" }}>✓</span>}
                        </button>
                    ))}
                </div>
            </div>
            <label className="form-label">
                <RequiredField label="Paciente" />
                <CustomSelect
                    value={form.patientId}
                    placeholder="Seleccionar paciente…"
                    options={patients.length > 0 ? patients.filter(p => p.status === "ACTIVE").map(p => ({ value: p.id, label: `${p.name} ${p.lastName}` })) : [ { value: "", label: "No hay pacientes registrados" } ]}
                    onChange={(v) => setForm(f => ({ ...f, patientId: v }))}
                />
            </label>
            <label className="form-label">
                <RequiredField label="Tipo de cita" />
                <CustomSelect
                    value={form.appointmentType?.id ?? ""}
                    placeholder="Seleccionar tipo…"
                    options={appointmentTypes.map(t => ({ value: t.id, label: t.name }))}
                    onChange={(v) => setForm(f => ({ ...f, appointmentType: appointmentTypes.find(t => t.id === v) }))}
                />
            </label>
        </div>
    );
}

function ChannelAndMessageStep({ form, setForm, selectedPatient, sendMode, set }: {
    form: ReminderForm;
    setForm: React.Dispatch<React.SetStateAction<ReminderForm>>;
    selectedPatient: Patient | undefined;
    sendMode: ReminderMode;
    set: SetField;
}) {
    return (
        <div className="form-stack">
            {selectedPatient && (
                <div className="patient-preview">
                    <div className="avatar avatar--md" style={{ background: getAvatarColor(selectedPatient.id) }}>
                        {getInitials(selectedPatient.name, selectedPatient.lastName)}
                    </div>
                    <div>
                        <div className="patient-preview__name">{selectedPatient.name} {selectedPatient.lastName}</div>
                        <div className="patient-preview__detail">{selectedPatient.email}</div>
                    </div>
                </div>
            )}
            <div>
                <div className="channel-section-label"><RequiredField label="Canal de notificación" /></div>
                <div style={{ display: "flex", gap: 10 }}>
                    {Object.values(Channel).map(c => {
                        const available = (c === Channel.WHATSAPP && !!selectedPatient?.whatsappNumber) || (c === Channel.SMS && !!selectedPatient?.smsNumber) //|| (c === Channel.EMAIL && !!selectedPatient?.email);
                        return (
                            <button
                                key={c}
                                onClick={() => available && setForm(f => ({ ...f, channel: c }))}
                                className={`selection-card${form.channel === c ? " selection-card--active" : ""}${!available ? " selection-card--disabled" : ""}`}
                                style={{ flex: 1 }}
                            >
                                <span style={{ fontSize: 22 }}>{CHANNEL_CFG[ c ].icon}</span>
                                <div>
                                    <div className="patient-preview__name">{CHANNEL_CFG[ c ].label}</div>
                                    <div className="patient-preview__detail">
                                        {available
                                            ? (c === Channel.WHATSAPP ? selectedPatient?.whatsappNumber : selectedPatient?.smsNumber)
                                            : "No disponible"}
                                    </div>
                                </div>
                                {form.channel === c && available && <span style={{ marginLeft: "auto", color: "var(--c-brand)" }}>✓</span>}
                            </button>
                        );
                    })}
                </div>
            </div>
            {sendMode === ReminderMode.SCHEDULED && (
                <label className="form-label">
                    <RequiredField label="Fecha y hora de envío" />
                    <DateTimePicker date={form.sendAt} onChanged={(d) => setForm(f => ({ ...f, sendAt: d }))} showTime isFuture />
                </label>
            )}
            <label className="form-label">
                <RequiredField label="Mensaje" />
                <textarea
                    className="form-input form-input--textarea"
                    style={{ minHeight: 100 }}
                    value={form.message}
                    onChange={set("message")}
                    placeholder={`Hola ${selectedPatient?.name ?? "{nombre}"}, le recordamos su cita${form.appointmentType ? ` de ${form.appointmentType}` : ""} próximamente. Por favor confirme su asistencia.`}
                />
                <span className="form-input-hint">{form.message.length} / 1600 caracteres</span>
                <div className="channel-section-label">Plantillas rápidas</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                        "Le recordamos su próxima cita médica. Por favor confirme su asistencia respondiendo este mensaje.",
                        "Su cita está confirmada para mañana. Recuerde traer su tarjeta de seguro y llegar 10 minutos antes.",
                        "Importante: No olvide su cita de mañana. Si necesita cancelar, contáctenos con 24 horas de anticipación.",
                    ].map((tmpl) => (
                        <button key={tmpl} onClick={() => setForm(f => ({ ...f, message: tmpl }))} className="template-btn">
                            {tmpl}
                        </button>
                    ))}
                </div>
            </label>
        </div>
    );
}

function SummaryStep({ form, selectedPatient, sendMode }: {
    form: ReminderForm;
    selectedPatient: Patient | undefined;
    sendMode: ReminderMode;
}) {
    return (
        <div className="form-stack">
            <div className="summary-card">
                <div className="summary-card__label">Resumen del recordatorio</div>
                {[
                    { k: "Paciente", v: selectedPatient ? `${selectedPatient.name} ${selectedPatient.lastName}` : "—" },
                    { k: "Canal", v: CHANNEL_CFG[ form.channel ].iconAndLabel },
                    { k: "Enviará a", v: form.channel === Channel.WHATSAPP ? (selectedPatient?.whatsappNumber ?? "—") : (selectedPatient?.smsNumber ?? "—") },
                    { k: "Programado", v: sendMode === ReminderMode.IMMEDIATE ? "Inmediatamente" : form.sendAt ? fmtDateTime(form.sendAt) : "—" },
                ].map(({ k, v }) => (
                    <div key={k} className="summary-row">
                        <span className="summary-row__key">{k}</span>
                        <span className="summary-row__value">{v}</span>
                    </div>
                ))}
                <div className="summary-card__divider">
                    <div className="summary-card__sublabel">Mensaje</div>
                    <div className="summary-card__body">{form.message || "—"}</div>
                </div>
            </div>
        </div>
    );
}
