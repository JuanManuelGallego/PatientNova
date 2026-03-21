import { btnPrimary } from "@/src/styles/theme";
import { Reminder, REMINDER_STATUS_CONFIG, getChannelLabel, getChannelIcon, ReminderStatus, ReminderMode } from "@/src/types/Reminder";
import { fmtDateAndTime } from "@/src/utils/TimeUtils";
import { ReminderStatusPill } from "../Info/StatusPill";
import { Section, Row } from "./DrawerUtils";

export function ReminderDrawer({ reminder, onClose, onEdit, onCancel }: {
    reminder: Reminder;
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
            <div style={{ flex: 1, background: "rgba(17,24,39,0.4)", backdropFilter: "blur(3px)" }} />
            <div style={{
                width: 420, background: "#fff", height: "100%", overflowY: "auto",
                boxShadow: "-10px 0 40px rgba(0,0,0,0.15)",
                display: "flex", flexDirection: "column",
            }} onClick={e => e.stopPropagation()}>
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
                <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
                    <Section title="Destinatario">
                        <Row icon="👤" label="Nombre" value={`${reminder.patient?.name ?? "—"} ${reminder.patient?.lastName ?? "—"}`} />
                        <Row icon="📞" label="Número" value={<span style={{ fontFamily: "monospace" }}>{reminder.to}</span>} />
                        <Row icon="📢" label="Modo" value={reminder.sendMode === ReminderMode.IMMEDIATE ? "Inmediato" : "Programado"} />
                    </Section>
                    <Section title="Programación">
                        <Row icon="⏰" label={isPending ? "Se envia el" : "Enviado el"} value={fmtDateAndTime(reminder.sendAt)} />
                        {reminder.sendAt && <Row icon="🗓️" label="Programado" value={fmtDateAndTime(reminder.sendAt)} />}
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
                    <Section title="Información del sistema">
                        <Row icon="🆔" label="ID" value={<span style={{ fontFamily: "monospace", fontSize: 11 }}>{reminder.id}</span>} />
                        <Row icon="📆" label="Creado" value={fmtDateAndTime(reminder.createdAt)} />
                        <Row icon="🔁" label="Actualizado" value={fmtDateAndTime(reminder.updatedAt)} />
                        <Row icon="🆔" label="Twillo ID" value={<span style={{ fontFamily: "monospace" }}>{reminder.messageId ?? '-'}</span>} />
                    </Section>
                </div>
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
