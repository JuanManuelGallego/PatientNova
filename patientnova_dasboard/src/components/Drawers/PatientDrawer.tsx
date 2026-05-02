import { APPT_STATUS_CFG } from "@/src/types/Appointment";
import { Patient, PATIENT_STATUS_CONFIG } from "@/src/types/Patient";
import { REMINDER_STATUS_CONFIG } from "@/src/types/Reminder";
import { fmtDate, fmtDateTime, RelativeTime } from "@/src/utils/TimeUtils";
import { PatientStatusPill, AppointmentStatusPill, ReminderStatusPill } from "../Info/StatusPill";
import { Section, Row } from "./DrawerUtils";
import { useFetchLocations } from "@/src/api/useFetchLocations";
import { useFetchAppointmentTypes } from "@/src/api/useFetchAppointmentTypes";
import { useState } from "react";
import Link from "next/link";
import { useFetchPatient } from "@/src/api/useFetchPatient";

export function PatientDrawer({ patient, onClose, onEdit, onDelete }: {
    patient: Patient;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const { patient: patientWithRelations } = useFetchPatient(patient.id);
    const s = PATIENT_STATUS_CONFIG[ patient.status ];
    const { locations } = useFetchLocations()
    const { appointmentTypes } = useFetchAppointmentTypes()

    const [ appointmentView, setAppointmentView ] = useState<RelativeTime>(RelativeTime.UPCOMING);
    const [ reminderView, setReminderView ] = useState<RelativeTime>(RelativeTime.UPCOMING);

    const filteredAppointments = patientWithRelations?.appointments?.filter(apt => {
        const now = new Date();
        const aptDate = new Date(apt.startAt);
        if (appointmentView === RelativeTime.UPCOMING) return aptDate >= now;
        if (appointmentView === RelativeTime.PAST) return aptDate < now;
        return true;
    }).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()) || [];

    const filteredReminders = patientWithRelations?.reminders?.filter(rem => {
        const now = new Date();
        const remDate = new Date(rem.sendAt);
        if (reminderView === RelativeTime.UPCOMING) return remDate >= now;
        if (reminderView === RelativeTime.PAST) return remDate < now;
        return true;
    }).sort((a, b) => new Date(a.sendAt).getTime() - new Date(b.sendAt).getTime()) || [];

    const locationNameById = locations.reduce((acc, loc) => ({ ...acc, [ loc.id ]: loc.name }), {} as Record<string, string>);
    const appointmentTypeNameById = appointmentTypes.reduce((acc, at) => ({ ...acc, [ at.id ]: at.name }), {} as Record<string, string>);

    return (
        <div className="drawer-overlay" onClick={onClose}>
            <div className="drawer-backdrop" />
            <div className="drawer-panel" onClick={e => e.stopPropagation()}>
                <div className="drawer-header" style={{ background: s.bg, borderBottom: `3px solid ${s.color}` }}>
                    <div className="drawer-header__top">
                        <div>
                            <div className="drawer-header__icon">{s.icon}</div>
                            <h2 className="drawer-header__title">{patient.name} {patient.lastName}</h2>
                            <div className="drawer-header__status"><PatientStatusPill status={patient.status} /></div>
                        </div>
                        <button onClick={onClose} className="btn-close--transparent">✕</button>
                    </div>
                </div>
                <div className="drawer-body">
                    <Section title="Información de Contacto">
                        {patient.email && <Row icon="📧" label="Correo" value={<a href={`mailto:${patient.email}`} className="td-email-link">{patient.email}</a>} />}
                        {patient.whatsappNumber && <Row icon="💬" label="WhatsApp" value={<span className="mono">{patient.whatsappNumber}</span>} />}
                        {patient.smsNumber && <Row icon="📱" label="SMS" value={<span className="mono">{patient.smsNumber}</span>} />}
                        {!patient.email && !patient.whatsappNumber && !patient.smsNumber && (
                            <div className="text-muted">Sin información de contacto registrada</div>
                        )}
                    </Section>
                    <Section title="Información Adicional">
                        {patient.dateOfBirth && <Row icon="📅" label="Fecha de Nacimiento" value={fmtDate(patient.dateOfBirth)} />}
                        {patient.notes && (
                            <div className="detail-row">
                                <span className="detail-row__icon">📝</span>
                                <div className="detail-row__content">
                                    <div className="notes-label">Notas</div>
                                    <div className="notes-text">{patient.notes}</div>
                                </div>
                            </div>
                        )}
                        {!patient.dateOfBirth && !patient.notes && (
                            <div className="text-muted">Sin información adicional</div>
                        )}
                        <Link href={`/medical-records?patientId=${patient.id}`} className="btn-secondary btn-primary--block" style={{ marginTop: 12, textDecoration: "none" }}>
                            Ver historia clínica
                        </Link>
                    </Section>
                    {filteredAppointments && filteredAppointments.length > 0 && (
                        <Section title="Citas Vinculadas">
                            <div className="filter-chips">
                                <button onClick={() => setAppointmentView(RelativeTime.UPCOMING)} className={`filter-chip ${appointmentView === RelativeTime.UPCOMING ? "filter-chip--active" : ""}`}>Próximas</button>
                                <button onClick={() => setAppointmentView(RelativeTime.PAST)} className={`filter-chip ${appointmentView === RelativeTime.PAST ? "filter-chip--active" : ""}`}>Pasadas</button>
                                <button onClick={() => setAppointmentView(RelativeTime.ALL)} className={`filter-chip ${appointmentView === RelativeTime.ALL ? "filter-chip--active" : ""}`}>Todas</button>
                            </div>
                            <div className="card-list">
                                {filteredAppointments.map(apt => {
                                    const aptStatus = APPT_STATUS_CFG[ apt.status ];
                                    return (
                                        <div key={apt.id} className="linked-card" style={{ borderLeft: `3px solid ${aptStatus.dot}` }}>
                                            <div className="linked-card__header">
                                                <div>
                                                    <div className="linked-card__title">{appointmentTypeNameById[ apt.typeId ?? "" ] || "Desconocido"}</div>
                                                    <div className="linked-card__meta">📅 {fmtDateTime(apt.startAt.toString())}</div>
                                                </div>
                                                <AppointmentStatusPill status={apt.status} />
                                            </div>
                                            <div className="linked-card__footer">
                                                <span>📍 {locationNameById[ apt.locationId ?? "" ] || "Desconocida"}</span>
                                                {apt.paid && <span>💰 Pagada</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Section>
                    )}
                    {filteredReminders && filteredReminders.length > 0 && (
                        <Section title="Recordatorios Vinculados">
                            <div className="filter-chips">
                                <button onClick={() => setReminderView(RelativeTime.UPCOMING)} className={`filter-chip ${reminderView === RelativeTime.UPCOMING ? "filter-chip--active" : ""}`}>Próximos</button>
                                <button onClick={() => setReminderView(RelativeTime.PAST)} className={`filter-chip ${reminderView === RelativeTime.PAST ? "filter-chip--active" : ""}`}>Pasados</button>
                                <button onClick={() => setReminderView(RelativeTime.ALL)} className={`filter-chip ${reminderView === RelativeTime.ALL ? "filter-chip--active" : ""}`}>Todos</button>
                            </div>
                            <div className="card-list">
                                {filteredReminders.map(rem => {
                                    const remStatus = REMINDER_STATUS_CONFIG[ rem.status ];
                                    const channelLabel = rem.channel === "WHATSAPP" ? "💬 WhatsApp" : "📱 SMS";
                                    return (
                                        <div key={rem.id} className="linked-card" style={{ borderLeft: `3px solid ${remStatus.dot}` }}>
                                            <div className="linked-card__header">
                                                <div>
                                                    <div className="linked-card__title">{channelLabel}</div>
                                                    <div className="linked-card__meta linked-card__meta--mono">{rem.sentAt ? `Enviado: ${fmtDateTime(rem.sentAt.toString())}` : `Programado: ${fmtDateTime(rem.sendAt.toString())}`}</div>
                                                </div>
                                                <ReminderStatusPill status={rem.status} />
                                            </div>
                                            {rem.error && (
                                                <div className="linked-card__error">⚠️ {rem.error}</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </Section>
                    )}
                    <Section title="Información del sistema">
                        <Row icon="🆔" label="ID" value={<span className="mono-sm">{patient.id}</span>} />
                        <Row icon="📆" label="Creado" value={new Date(patient.createdAt).toLocaleString("es-ES")} />
                        <Row icon="🔁" label="Actualizado" value={new Date(patient.updatedAt).toLocaleString("es-ES")} />
                        {patient.archivedAt && <Row icon="🗃️" label="Archivado" value={new Date(patient.archivedAt).toLocaleString("es-ES")} />}
                    </Section>
                </div>
                <div className="drawer-footer">
                    <button onClick={onEdit} className="btn-primary btn-primary--block">✏️ Editar</button>
                    <button onClick={onDelete} className="btn-drawer-delete">🗑️</button>
                </div>
            </div>
        </div>
    );
}
