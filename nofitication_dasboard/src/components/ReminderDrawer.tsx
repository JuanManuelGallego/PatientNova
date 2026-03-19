import { btnPrimary } from "../styles/theme";
import { Reminder, ReminderMode, REMINDER_STATUS_CONFIG, getChannelIcon, getChannelLabel, ReminderStatus } from "../types/Reminder";
import { fmtDateTime } from "../utils/TimeUtils";
import { ReminderStatusPill } from "./StatusPill";

export function ReminderDrawer({ reminder, patientName, onClose, onEdit, onCancel }: {
    reminder: Reminder;
    patientName?: string;
    onClose: () => void;
    onEdit: () => void;
    onCancel: () => void;
}) {
    const s = REMINDER_STATUS_CONFIG[ reminder.status ];
    const channelLabel = getChannelLabel(reminder.channel);
    const channelIcon = getChannelIcon(reminder.channel);
    const isPending = reminder.status === ReminderStatus.PENDING;

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex" }} onClick={onClose}>
            {/* Overlay */}
            <div style={{ flex: 1, background: "rgba(17,24,39,0.4)", backdropFilter: "blur(3px)" }} />
            {/* Drawer */}
            <div style={{
                width: 420, background: "#fff", height: "100%", overflowY: "auto",
                boxShadow: "-10px 0 40px rgba(0,0,0,0.15)", animation: "slideInRight 0.25s ease",
                display: "flex", flexDirection: "column",
            }} onClick={e => e.stopPropagation()}>

                {/* Header strip */}
                <div style={{ background: s.bg, padding: "24px 24px 20px", borderBottom: `3px solid ${s.dot}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                            <div style={{ fontSize: 22, marginBottom: 6 }}>{channelIcon}</div>
                            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>{channelLabel}</h2>
                            <div style={{ marginTop: 8 }}><ReminderStatusPill status={reminder.status} /></div>
                        </div>
                        <button onClick={onClose} style={{ background: "rgba(0,0,0,0.08)", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#6B7280" }}>✕</button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>

                    {/* Recipient */}
                    <Section title="Destinatario">
                        <Row icon="👤" label="Nombre" value={patientName ?? "—"} />
                        <Row icon="📞" label="Número" value={<span style={{ fontFamily: "monospace" }}>{reminder.to}</span>} />
                        <Row icon="📢" label="Modo" value={reminder.mode === ReminderMode.NOW ? "Inmediato" : "Programado"} />
                    </Section>

                    {/* Scheduling */}
                    <Section title="Programación">
                        <Row icon="⏰" label={isPending ? "Se envia el" : "Enviado el"} value={fmtDateTime(reminder.sentAt)} />
                        {reminder.scheduledAt && <Row icon="🗓️" label="Programado" value={fmtDateTime(reminder.scheduledAt)} />}
                    </Section>


                    <Section title="Mensaje">
                        <Row icon="✉️" label="Mensaje" value={<span style={{ fontFamily: "monospace" }}>{reminder.contentSid}</span>} />
                    </Section>

                    {reminder.error && (
                        <Section title="Error">
                            <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#DC2626" }}>
                                {reminder.error}
                            </div>
                        </Section>
                    )}

                    {/* Meta */}
                    <Section title="Información del sistema">
                        <Row icon="🆔" label="ID" value={<span style={{ fontFamily: "monospace", fontSize: 11 }}>{reminder.id}</span>} />
                        <Row icon="📆" label="Creado" value={fmtDateTime(reminder.createdAt)} />
                        <Row icon="🔁" label="Actualizado" value={fmtDateTime(reminder.updatedAt)} />
                        <Row icon="🆔" label="Twillo ID" value={<span style={{ fontFamily: "monospace" }}>{reminder.messageId ?? '-'}</span>} />
                    </Section>
                </div>

                {/* Footer actions */}
                {isPending && <div style={{ padding: "16px 24px", borderTop: "1px solid #F3F4F6", display: "flex", gap: 8 }}>
                    <button onClick={onEdit} style={{ ...btnPrimary, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        ✏️ Reprogramar
                    </button>
                    <button onClick={onCancel} style={{
                        padding: "10px 16px", background: "#FEF2F2", border: "none", borderRadius: 10,
                        fontSize: 14, fontWeight: 600, color: "#DC2626", cursor: "pointer",
                    }}>
                        🗑️ Cancelar
                    </button>
                </div>}
            </div>
        </div>
    );
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>{title}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
        </div>
    );
}

function Row({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14, width: 20, textAlign: "center", flexShrink: 0 }}>{icon}</span>
            <span style={{ fontSize: 13, color: "#6B7280", minWidth: 80 }}>{label}</span>
            <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{value}</span>
        </div>
    );
}
