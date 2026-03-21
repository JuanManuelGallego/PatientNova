import { btnPrimary } from "@/src/styles/theme";
import { Appointment, STATUS_CFG } from "@/src/types/Appointment";
import { CHANNEL_LABEL, REMINDER_STATUS_CONFIG } from "@/src/types/Reminder";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import { fmtDate, fmtDateAndTime, getDuration } from "@/src/utils/TimeUtils";
import { PayBadge } from "../Info/PayBadge";
import { AppointmentStatusPill } from "../Info/StatusPill";
import { Section, Row } from "./DrawerUtils";

export function AppointmentDrawer({ appt, onClose, onEdit, onPay, onDelete }: {
    appt: Appointment;
    onClose: () => void;
    onEdit: () => void;
    onPay: () => void;
    onDelete: () => void;
}) {
    const s = STATUS_CFG[ appt.status ];
    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex" }} onClick={onClose}>
            <div style={{ flex: 1, background: "rgba(17,24,39,0.4)", backdropFilter: "blur(3px)" }} />
            <div style={{
                width: 420, background: "#fff", height: "100%", overflowY: "auto",
                boxShadow: "-10px 0 40px rgba(0,0,0,0.15)", animation: "slideInRight 0.25s ease",
                display: "flex", flexDirection: "column",
            }} onClick={e => e.stopPropagation()}>
                <div style={{ background: s.bg, padding: "24px 24px 20px", borderBottom: `3px solid ${s.dot}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>{appt.type}</h2>
                            <div style={{ marginTop: 8 }}><AppointmentStatusPill status={appt.status} /></div>
                        </div>
                        <button onClick={onClose} style={{ background: "rgba(0,0,0,0.08)", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#6B7280" }}>✕</button>
                    </div>
                </div>
                <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
                    <Section title="Paciente">
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 42, height: 42, borderRadius: "50%", background: getAvatarColor(appt.patient.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#1E3A5F", flexShrink: 0 }}>
                                {getInitials(appt.patient.name, appt.patient.lastName)}
                            </div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{appt.patient.name} {appt.patient.lastName}</div>
                                <div style={{ fontSize: 13, color: "#9CA3AF" }}>{appt.patient.email}</div>
                            </div>
                        </div>
                    </Section>
                    <Section title="Fecha y Hora">
                        <Row icon="📅" label="Fecha" value={fmtDate(appt.startAt)} />
                        <Row icon="🕐" label="Hora" value={fmtDateAndTime(appt.startAt)} />
                        <Row icon="⏱️" label="Duración" value={getDuration(appt.startAt, appt.endAt)} />
                    </Section>
                    <Section title="Lugar">
                        <Row icon="📍" label="Ubicación" value={appt.location} />
                        {appt.meetingUrl && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 14 }}>🔗</span>
                                <a href={appt.meetingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#2563EB", wordBreak: "break-all" }}>Unirse a la videollamada</a>
                            </div>
                        )}
                    </Section>
                    <Section title="Pago">
                        <Row icon="💰" label="Precio" value={`$${appt.price}`} />
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <Row icon="💳" label="Estado" value={<PayBadge paid={appt.paid} />} />
                            {!appt.paid && (
                                <button onClick={onPay} style={{ ...btnPrimary, padding: "6px 14px", fontSize: 12, background: "#16A34A" }}>
                                    Marcar pagado
                                </button>
                            )}
                        </div>
                    </Section>
                    <Section title="Notas">
                        <Row icon="📝" label="Notas" value={`${appt.notes || "Ninguna Nota"}`} />
                    </Section>
                    {appt.reminder && (
                        <Section title="Recordatorio Vinculado">
                            <Row icon={appt.reminder.channel === "WHATSAPP" ? "💬" : "📱"} label="Canal" value={CHANNEL_LABEL[ appt.reminder.channel ]} />
                            <Row icon="📤" label="Estado" value={REMINDER_STATUS_CONFIG[ appt.reminder.status ].label} />
                            <Row icon="🗓️" label="Envío" value={new Date(appt.reminder.sendAt).toLocaleString("es-ES")} />
                        </Section>
                    )}
                    <Section title="Información del sistema">
                        <Row icon="🆔" label="ID" value={<span style={{ fontFamily: "monospace", fontSize: 11 }}>{appt.id}</span>} />
                        <Row icon="📆" label="Creada" value={new Date(appt.createdAt).toLocaleString("es-ES")} />
                    </Section>
                </div>
                <div style={{ padding: "16px 24px", borderTop: "1px solid #F3F4F6", display: "flex", gap: 8 }}>
                    <button onClick={onEdit} style={{ ...btnPrimary, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        ✏️ Editar
                    </button>
                    <button onClick={onDelete} style={{
                        padding: "10px 16px", background: "#FEF2F2", border: "none", borderRadius: 10,
                        fontSize: 14, fontWeight: 600, color: "#DC2626", cursor: "pointer",
                    }}>
                        🗑️
                    </button>
                </div>
            </div>
        </div>
    );
}
