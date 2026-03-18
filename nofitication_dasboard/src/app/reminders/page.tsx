"use client";;
import { Patient } from '@/src/types/Patient';
import Sidebar from '../../components/Sidebar';
import { useState } from "react";
import { Reminder, ReminderStatus } from '@/src/types/Reminder';
import { btnPrimary, thStyle, tdStyle } from '@/src/styles/theme';
import { fmtDateTime, fmtRelative } from '@/src/utils/TimeUtils';
import { ReminderStatusPill } from '@/src/components/StatusPill';
import { StatCard } from '@/src/components/StatCard';
import { ChannelBadge } from '@/src/components/ChannelIcon';
import { ErrorBanner } from '@/src/components/ErrorBanner';
import { ReminderModal } from '@/src/components/ReminderModal';
import { EditScheduledReminderModal } from '@/src/components/EditScheduledReminderJobModal';
import { ReminderDrawer } from '@/src/components/ReminderDrawer';
import { BulkSendWizard } from '@/src/components/BulkSendWizard';
import { EmptyState } from '@/src/components/EmptyState';
import { SkeletonRow } from '@/src/components/Skeleton';
import { CancelReminderModal } from '@/src/components/CancelReminderModal';
import { useFetchReminders } from '@/src/api/useFetchReminders';
import { useFetchPatients } from '@/src/api/useFetchPatients';

type ActiveTab = "Active" | "History" | "Bulk";

export default function RemindersPage() {
    const [ activeTab, setActiveTab ] = useState<ActiveTab>("Active");
    const { reminders, loading: loadingReminders, error: errorReminders, fetchReminders } = useFetchReminders();
    const { patients } = useFetchPatients();
    const [ showCreate, setShowCreate ] = useState(false);
    const [ editReminder, setEditReminder ] = useState<Reminder | null>(null);
    const [ search, setSearch ] = useState("");
    const [ viewReminder, setViewReminder ] = useState<Reminder | null>(null);
    const [ cancelReminder, setCancelReminder ] = useState<Reminder | null>(null);



    const active = reminders.filter(reminder => reminder.status === ReminderStatus.PENDING);
    const history = reminders.filter(reminder => reminder.status !== ReminderStatus.PENDING);

    const filteredActive = active.filter(reminder =>
        !search || (reminder.to ?? "").includes(search) || reminder.channel.includes(search)
    );
    const filteredHistory = history.filter(reminder =>
        !search || (reminder.to ?? "").includes(search) || reminder.channel.includes(search)
    );

    const counts = {
        active: active.length,
        sent: reminders.filter(reminder => reminder.status === ReminderStatus.SENT).length,
        failed: reminders.filter(reminder => reminder.status === ReminderStatus.FAILED).length,
        cancelled: reminders.filter(reminder => reminder.status === ReminderStatus.CANCELLED).length,
    };

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 3px; }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        tr:hover td { background: #F9FAFB !important; transition: background 0.1s; }
      `}</style>
            <div style={{ display: "flex", minHeight: "100vh", background: "#F8F7F4", fontFamily: "'DM Sans', sans-serif" }}>
                <Sidebar />
                <main style={{ marginLeft: 240, flex: 1, padding: "36px 40px", maxWidth: "calc(100% - 240px)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 36 }}>
                        <div>
                            <h1 style={{ fontSize: 30, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em", fontFamily: "'Playfair Display', Georgia, serif", marginBottom: 6 }}>
                                Recordatorios
                            </h1>
                            <p style={{ fontSize: 14, color: "#9CA3AF" }}>
                                {new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                            </p>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setShowCreate(true)} style={{
                                ...btnPrimary, display: "flex", alignItems: "center", gap: 8,
                                boxShadow: "0 4px 14px rgba(30,58,95,0.3)", padding: "12px 24px",
                            }}>
                                <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Nuevo Recordatorio
                            </button>
                        </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 36 }}>
                        <StatCard label="Activos" value={counts.active} sub="en cola de envío" accent="#2563EB" />
                        <StatCard label="Enviados" value={counts.sent} sub="entregados" accent="#16A34A" />
                        <StatCard label="Fallidos" value={counts.failed} sub="requieren atención" accent="#DC2626" />
                        <StatCard label="Cancelados" value={counts.cancelled} sub="fuera de la cola" accent="#9CA3AF" />
                    </div>
                    <div style={{ display: "flex", gap: 4, background: "#fff", borderRadius: 12, padding: 5, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", width: "fit-content" }}>
                        {([
                            { key: "Active", label: "Activos", badge: counts.active },
                            { key: "History", label: "Historial", badge: counts.sent + counts.failed + counts.cancelled },
                            { key: "Bulk", label: "Envío Masivo", badge: null },
                        ] as const).map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                                padding: "9px 20px", borderRadius: 9, border: "none", cursor: "pointer",
                                background: activeTab === tab.key ? "#1E3A5F" : "transparent",
                                color: activeTab === tab.key ? "#fff" : "#6B7280",
                                fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8,
                                transition: "all 0.15s",
                            }}>
                                {tab.label}
                                {tab.badge !== null && (
                                    <span style={{
                                        background: activeTab === tab.key ? "rgba(255,255,255,0.2)" : "#F3F4F6",
                                        color: activeTab === tab.key ? "#fff" : "#374151",
                                        fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 20,
                                    }}>{tab.badge}</span>
                                )}
                            </button>
                        ))}
                    </div>
                    {activeTab !== "Bulk" && (
                        <div style={{
                            background: "#fff", borderRadius: 16, padding: "18px 24px",
                            display: "flex", alignItems: "center", gap: 16, marginBottom: 16,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                        }}>
                            <input
                                placeholder="Buscar por número, canal…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ flex: 1, padding: "9px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", color: "#111827", background: "#FAFAFA" }}
                            />
                        </div>
                    )}
                    {errorReminders && activeTab !== "Bulk" && <ErrorBanner msg={errorReminders} onRetry={fetchReminders} />}
                    {activeTab === "Active" && (
                        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden", animation: "fadeIn 0.25s ease" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ background: "#F9FAFB" }}>
                                        {[ "Destinatario", "Canal", "Estado", "Programado para", "En", "Creado el", "" ].map(h => (
                                            <th key={h} style={thStyle}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingReminders && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
                                    {!loadingReminders && filteredActive.map((reminder, i) => (
                                        <tr key={reminder.id} style={{ borderBottom: i < filteredActive.length - 1 ? "1px solid #F3F4F6" : "none", cursor: "pointer" }}
                                            onClick={() => setViewReminder(reminder)}>
                                            <td style={tdStyle}>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{patients.find(p => p.id === reminder.patientId)?.fullName ?? "—"}</div>
                                                <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace" }}>{reminder.to}</div>
                                            </td>
                                            <td style={tdStyle}><ChannelBadge channel={reminder.channel} /></td>
                                            <td style={tdStyle}><ReminderStatusPill status={reminder.status} /></td>
                                            <td style={{ ...tdStyle, fontSize: 13, color: "#374151" }}>{fmtDateTime(reminder.sendAt)}</td>
                                            <td style={{ ...tdStyle, fontSize: 13, color: "#6B7280", whiteSpace: "nowrap" }}>
                                                <span style={{ background: "#EFF6FF", color: "#2563EB", padding: "3px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                                                    {fmtRelative(reminder.sendAt)}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, fontSize: 13, color: "#9CA3AF" }}>{fmtDateTime(reminder.sendAt)}</td>
                                            <td style={tdStyle} onClick={e => e.stopPropagation()}>
                                                <div style={{ display: "flex", gap: 6 }}>
                                                    <button onClick={() => setEditReminder(reminder)} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, background: "#EFF6FF", border: "none", borderRadius: 7, color: "#2563EB", cursor: "pointer" }}>
                                                        Reprogramar
                                                    </button>
                                                    <button onClick={() => setCancelReminder(reminder)} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, background: "#FEF2F2", border: "none", borderRadius: 7, color: "#DC2626", cursor: "pointer" }}>
                                                        Cancelar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {!loadingReminders && filteredActive.length === 0 && (
                                        <EmptyState icon="🔔" title="Sin recordatorios activos" sub="Haz clic en Nuevo Recordatorio para programar el primero." />
                                    )}
                                </tbody>
                            </table>
                            {!loadingReminders && filteredActive.length > 0 && (
                                <div style={{ padding: "12px 20px", borderTop: "1px solid #F3F4F6", background: "#FAFAFA", display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ fontSize: 13, color: "#9CA3AF" }}>
                                        <strong style={{ color: "#374151" }}>{filteredActive.length}</strong> recordatorio(s) activo(s)
                                    </span>
                                    <span style={{ fontSize: 12, color: "#D1D5DB" }}>Actualizado: {new Date().toLocaleTimeString("es-ES")}</span>
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === "History" && (
                        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden", animation: "fadeIn 0.25s ease" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ background: "#F9FAFB" }}>
                                        {[ "Destinatario", "Canal", "Estado", "Enviado", "ID Mensaje", "Error" ].map(h => (
                                            <th key={h} style={thStyle}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingReminders && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
                                    {!loadingReminders && filteredHistory.map((reminder, i) => (
                                        <tr key={reminder.id} style={{ borderBottom: i < filteredHistory.length - 1 ? "1px solid #F3F4F6" : "none", cursor: "pointer" }}
                                            onClick={() => setViewReminder(reminder)}>

                                            <td style={tdStyle}>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{patients.find(p => p.id === reminder.patientId)?.fullName ?? "—"}</div>
                                                <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace" }}>{reminder.to}</div>
                                            </td>
                                            <td style={tdStyle}><ChannelBadge channel={reminder.channel} /></td>
                                            <td style={tdStyle}><ReminderStatusPill status={reminder.status} /></td>
                                            <td style={{ ...tdStyle, fontSize: 13, color: "#6B7280" }}>{fmtDateTime(reminder.sendAt)}</td>
                                            <td style={{ ...tdStyle, fontSize: 12, color: "#9CA3AF", fontFamily: "monospace" }}>
                                                {reminder.messageId ? (
                                                    <span title={reminder.messageId}>{reminder.messageId}</span>
                                                ) : "—"}
                                            </td>
                                            <td style={{ ...tdStyle, fontSize: 12, color: "#DC2626", maxWidth: 200 }}>
                                                {reminder.error
                                                    ? <span title={reminder.error} style={{ background: "#FEF2F2", padding: "3px 8px", borderRadius: 6 }}>{reminder.error.slice(0, 40)}{reminder.error.length > 40 ? "…" : ""}</span>
                                                    : <span style={{ color: "#D1D5DB" }}>—</span>
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                    {!loadingReminders && filteredHistory.length === 0 && (
                                        <EmptyState icon="📋" title="Sin historial aún" sub="Los recordatorios enviados, fallidos y cancelados aparecerán aquí." />
                                    )}
                                </tbody>
                            </table>
                            {!loadingReminders && filteredHistory.length > 0 && (
                                <div style={{ padding: "12px 20px", borderTop: "1px solid #F3F4F6", background: "#FAFAFA" }}>
                                    <span style={{ fontSize: 13, color: "#9CA3AF" }}>
                                        <strong style={{ color: "#374151" }}>{filteredHistory.length}</strong> registros en el historial
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === "Bulk" && (
                        <div style={{ animation: "fadeIn 0.25s ease" }}>
                            <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "14px 20px", marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 12 }}>
                                <span style={{ fontSize: 20 }}>📣</span>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1E40AF", marginBottom: 3 }}>Envío Masivo</div>
                                    <div style={{ fontSize: 13, color: "#3B82F6" }}>
                                        Envía el mismo mensaje a múltiples pacientes a la vez. Solo se incluyen pacientes con estado <strong>Activo</strong> y número registrado para el canal seleccionado.
                                    </div>
                                </div>
                            </div>
                            <BulkSendWizard patients={patients} />
                        </div>
                    )}
                </main>
            </div>
            {showCreate && (
                <ReminderModal patients={patients} onClose={() => { setShowCreate(false); fetchReminders() }} onSaved={fetchReminders} />
            )}
            {editReminder && (
                <EditScheduledReminderModal reminder={editReminder} patients={patients} onClose={() => setEditReminder(null)} onSaved={fetchReminders} />
            )}
            {viewReminder && (
                <ReminderDrawer
                    reminder={viewReminder}
                    patientName={patients.find(p => p.id === viewReminder.patientId)?.fullName}
                    onClose={() => setViewReminder(null)}
                    onEdit={() => { setEditReminder(viewReminder); setViewReminder(null); }}
                    onCancel={() => { setCancelReminder(viewReminder); setViewReminder(null); }}
                />
            )}
            {cancelReminder && (
                <CancelReminderModal
                    reminder={cancelReminder}
                    onClose={() => setCancelReminder(null)}
                    onCanceled={() => { setCancelReminder(null); fetchReminders(); }}
                    patientName={patients.find(p => p.id === cancelReminder.patientId)?.fullName}
                />

            )}
        </>
    );
}
