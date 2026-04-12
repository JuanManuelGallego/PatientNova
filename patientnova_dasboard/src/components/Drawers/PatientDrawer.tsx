import { APPT_STATUS_CFG } from "@/src/types/Appointment";
import { Patient, PATIENT_STATUS_CONFIG } from "@/src/types/Patient";
import { REMINDER_STATUS_CONFIG } from "@/src/types/Reminder";
import { fmtDate, fmtDateTime } from "@/src/utils/TimeUtils";
import { PatientStatusPill, AppointmentStatusPill, ReminderStatusPill } from "../Info/StatusPill";
import { Section, Row } from "./DrawerUtils";

export function PatientDrawer({ patient, onClose, onEdit, onDelete }: {
    patient: Patient;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const s = PATIENT_STATUS_CONFIG[ patient.status ];

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
                    </Section>
                    {patient.appointments && patient.appointments.length > 0 && (
                        <Section title="Citas Vinculadas">
                            <div className="card-list">
                                {patient.appointments.map(apt => {
                                    const aptStatus = APPT_STATUS_CFG[ apt.status ];
                                    return (
                                        <div key={apt.id} className="linked-card" style={{ borderLeft: `3px solid ${aptStatus.dot}` }}>
                                            <div className="linked-card__header">
                                                <div>
                                                    <div className="linked-card__title">{apt.appointmentType.name}</div>
                                                    <div className="linked-card__meta">📅 {fmtDateTime(apt.startAt.toString())}</div>
                                                </div>
                                                <AppointmentStatusPill status={apt.status} />
                                            </div>
                                            <div className="linked-card__footer">
                                                <span>📍 {apt.appointmentLocation.name}</span>
                                                {apt.paid && <span>💰 Pagada</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Section>
                    )}
                    {patient.reminders && patient.reminders.length > 0 && (
                        <Section title="Recordatorios Vinculados">
                            <div className="card-list">
                                {patient.reminders.map(rem => {
                                    const remStatus = REMINDER_STATUS_CONFIG[ rem.status ];
                                    const channelLabel = rem.channel === "WHATSAPP" ? "💬 WhatsApp" : "📱 SMS";
                                    return (
                                        <div key={rem.id} className="linked-card" style={{ borderLeft: `3px solid ${remStatus.dot}` }}>
                                            <div className="linked-card__header">
                                                <div>
                                                    <div className="linked-card__title">{channelLabel}</div>
                                                    <div className="linked-card__meta linked-card__meta--mono">Envío: {rem.sentAt ? fmtDateTime(rem.sentAt.toString()) : "Pendiente"}</div>
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
