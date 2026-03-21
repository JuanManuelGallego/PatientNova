"use client";;
import { useMemo, useState } from "react";
import { FetchRemindersFilters, Reminder, ReminderStatus } from '@/src/types/Reminder';
import { btnPrimary, tdStyle } from '@/src/styles/theme';
import { fmtDateAndTime, fmtRelative } from '@/src/utils/TimeUtils';
import { StatCard } from '@/src/components/Info/StatCard';
import { ChannelBadge } from '@/src/components/Info/ChannelIcon';
import { ReminderModal } from '@/src/components/Modals/ReminderModal';
import { EditScheduledReminderModal } from '@/src/components/Modals/EditScheduledReminderModal';
import { ReminderDrawer } from '@/src/components/Drawers/ReminderDrawer';
import { BulkSendWizard } from '@/src/components/Navigation/BulkSendWizard';
import { EmptyState } from '@/src/components/EmptyState';
import { DataTable } from '@/src/components/DataTable';
import { CancelReminderModal } from '@/src/components/Modals/CancelReminderModal';
import { useFetchReminders } from '@/src/api/useFetchReminders';
import { useFetchPatients } from '@/src/api/useFetchPatients';
import { ErrorBanner } from '@/src/components/Info/ErrorBanner';
import { ReminderStatusPill } from '@/src/components/Info/StatusPill';
import Sidebar from "@/src/components/Navigation/Sidebar";
import { useFetchRemindersStats } from "@/src/api/useFetchRemindersStats";
import { useDebounceState } from "@/src/utils/useDebounceState";

type ActiveTab = "Active" | "History" | "Bulk";
const PAGE_SIZE = 10;

export default function RemindersPage() {
    const { patients } = useFetchPatients();
    const { stats } = useFetchRemindersStats();
    const [ activeTab, setActiveTab ] = useState<ActiveTab>("Active");
    const [ page, setPage ] = useState(1);

    const [ showCreate, setShowCreate ] = useState(false);
    const [ editReminder, setEditReminder ] = useState<Reminder | null>(null);
    const [ search, setSearch ] = useState("");
    const debouncedSearch = useDebounceState(search, 250);

    const [ viewReminder, setViewReminder ] = useState<Reminder | null>(null);
    const [ cancelReminder, setCancelReminder ] = useState<Reminder | null>(null);

    const filters = useMemo<FetchRemindersFilters>(() => ({
        status: activeTab === "Active" ? [ ReminderStatus.PENDING ] : activeTab === "History" ? [ ReminderStatus.SENT, ReminderStatus.FAILED, ReminderStatus.CANCELLED ] : undefined,
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch.trim() || undefined,
        orderBy: "sendAt",
        order: "asc",
    }), [ page, debouncedSearch, activeTab ]);

    const { reminders, loading, error, fetchReminders, total, totalPages } = useFetchReminders(filters);

    return (
        <>
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
                        <StatCard label="Activos" value={stats?.byStatus[ ReminderStatus.PENDING ] || 0} sub="en cola de envío" accent="#2563EB" />
                        <StatCard label="Enviados" value={stats?.byStatus[ ReminderStatus.SENT ] || 0} sub="entregados" accent="#16A34A" />
                        <StatCard label="Fallidos" value={stats?.byStatus[ ReminderStatus.FAILED ] || 0} sub="requieren atención" accent="#DC2626" />
                        <StatCard label="Cancelados" value={stats?.byStatus[ ReminderStatus.CANCELLED ] || 0} sub="fuera de la cola" accent="#9CA3AF" />
                    </div>
                    <div style={{ display: "flex", gap: 4, background: "#fff", borderRadius: 12, padding: 5, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", width: "fit-content" }}>
                        {([
                            { key: "Active", label: "Activos", badge: stats?.byStatus[ ReminderStatus.PENDING ] || 0 },
                            { key: "History", label: "Historial", badge: (stats?.byStatus[ ReminderStatus.SENT ] || 0) + (stats?.byStatus[ ReminderStatus.FAILED ] || 0) + (stats?.byStatus[ ReminderStatus.CANCELLED ] || 0) },
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
                                placeholder="Buscar por nombre, número, canal…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ flex: 1, padding: "9px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", color: "#111827", background: "#FAFAFA" }}
                            />
                        </div>
                    )}
                    {error && activeTab !== "Bulk" && <ErrorBanner msg={error} onRetry={fetchReminders} />}
                    {activeTab === "Active" && (
                        <DataTable
                            columns={[ "Destinatario", "Canal", "Estado", "Programado para", "En", "Creado el", "" ]}
                            rows={reminders}
                            loading={loading}
                            skeletonCount={4}
                            renderRow={(reminder, i) => (
                                <tr key={reminder.id} style={{ borderBottom: i < reminders.length - 1 ? "1px solid #F3F4F6" : "none", cursor: "pointer" }}
                                    onClick={() => setViewReminder(reminder)}>
                                    <td style={tdStyle}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{reminder.patient?.name ?? "—"} {reminder.patient?.lastName ?? "—"}</div>
                                        <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace" }}>{reminder.to}</div>
                                    </td>
                                    <td style={tdStyle}><ChannelBadge channel={reminder.channel} /></td>
                                    <td style={tdStyle}><ReminderStatusPill status={reminder.status} /></td>
                                    <td style={{ ...tdStyle, fontSize: 13, color: "#374151" }}>{fmtDateAndTime(reminder.sendAt)}</td>
                                    <td style={{ ...tdStyle, fontSize: 13, color: "#6B7280", whiteSpace: "nowrap" }}>
                                        <span style={{ background: "#EFF6FF", color: "#2563EB", padding: "3px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                                            {fmtRelative(reminder.sendAt)}
                                        </span>
                                    </td>
                                    <td style={{ ...tdStyle, fontSize: 13, color: "#9CA3AF" }}>{fmtDateAndTime(reminder.sendAt)}</td>
                                    <td style={tdStyle} onClick={e => e.stopPropagation()}>
                                        <div style={{ display: "flex", gap: 6 }}>
                                            <button onClick={() => setEditReminder(reminder)} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, background: "#EFF6FF", border: "none", borderRadius: 7, color: "#2563EB", cursor: "pointer" }}>Reprogramar</button>
                                            <button onClick={() => setCancelReminder(reminder)} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, background: "#FEF2F2", border: "none", borderRadius: 7, color: "#DC2626", cursor: "pointer" }}>Cancelar</button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            emptyState={<EmptyState icon="🔔" title="Sin recordatorios activos" sub="Haz clic en Nuevo Recordatorio para programar el primero." />}
                            footer={
                                <>
                                    <span style={{ fontSize: 13, color: "#9CA3AF" }}>
                                        Mostrando <strong style={{ color: "#374151" }}>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}</strong> de <strong style={{ color: "#374151" }}>{total}</strong> recordatorios
                                    </span>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        {page !== 1 && <button onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: "5px 12px", borderRadius: 7, border: "1.5px solid #E5E7EB", background: page === 1 ? "#F9FAFB" : "#fff", color: page === 1 ? "#D1D5DB" : "#374151", fontSize: 13, fontWeight: 500, cursor: page === 1 ? "default" : "pointer" }}>← Anterior</button>}
                                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                                            .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                                            .reduce<(number | "...")[]>((acc, n, idx, arr) => {
                                                if (idx > 0 && n - (arr[ idx - 1 ] as number) > 1) acc.push("...");
                                                acc.push(n);
                                                return acc;
                                            }, [])
                                            .map((item, idx) =>
                                                item === "..." ? (
                                                    <span key={`ellipsis-${idx}`} style={{ fontSize: 13, color: "#9CA3AF", padding: "0 4px" }}>…</span>
                                                ) : (
                                                    <button key={item} onClick={() => setPage(item as number)} style={{ width: 32, height: 32, borderRadius: 7, border: "1.5px solid", borderColor: page === item ? "#1E3A5F" : "#E5E7EB", background: page === item ? "#1E3A5F" : "#fff", color: page === item ? "#fff" : "#374151", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{item}</button>
                                                )
                                            )
                                        }
                                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "5px 12px", borderRadius: 7, border: "1.5px solid #E5E7EB", background: page === totalPages ? "#F9FAFB" : "#fff", color: page === totalPages ? "#D1D5DB" : "#374151", fontSize: 13, fontWeight: 500, cursor: page === totalPages ? "default" : "pointer" }}>Siguiente →</button>
                                    </div>
                                </>
                            }
                        />
                    )}
                    {activeTab === "History" && (
                        <DataTable
                            columns={[ "Destinatario", "Canal", "Estado", "Enviado", "ID Mensaje", "Error" ]}
                            rows={reminders}
                            loading={loading}
                            skeletonCount={5}
                            renderRow={(reminder, i) => (
                                <tr key={reminder.id} style={{ borderBottom: i < reminders.length - 1 ? "1px solid #F3F4F6" : "none", cursor: "pointer" }}
                                    onClick={() => setViewReminder(reminder)}>
                                    <td style={tdStyle}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{reminder.patient?.name ?? "—"} {reminder.patient?.lastName ?? "—"}</div>
                                        <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace" }}>{reminder.to}</div>
                                    </td>
                                    <td style={tdStyle}><ChannelBadge channel={reminder.channel} /></td>
                                    <td style={tdStyle}><ReminderStatusPill status={reminder.status} /></td>
                                    <td style={{ ...tdStyle, fontSize: 13, color: "#6B7280" }}>{fmtDateAndTime(reminder.sendAt)}</td>
                                    <td style={{ ...tdStyle, fontSize: 12, color: "#9CA3AF", fontFamily: "monospace" }}>
                                        {reminder.messageId ? <span title={reminder.messageId}>{reminder.messageId}</span> : "—"}
                                    </td>
                                    <td style={{ ...tdStyle, fontSize: 12, color: "#DC2626", maxWidth: 200 }}>
                                        {reminder.error
                                            ? <span title={reminder.error} style={{ background: "#FEF2F2", padding: "3px 8px", borderRadius: 6 }}>{reminder.error.slice(0, 40)}{reminder.error.length > 40 ? "…" : ""}</span>
                                            : <span style={{ color: "#D1D5DB" }}>—</span>
                                        }
                                    </td>
                                </tr>
                            )}
                            emptyState={<EmptyState icon="📋" title="Sin historial aún" sub="Los recordatorios enviados, fallidos y cancelados aparecerán aquí." />}
                            footer={
                                <>
                                    <span style={{ fontSize: 13, color: "#9CA3AF" }}>
                                        Mostrando <strong style={{ color: "#374151" }}>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}</strong> de <strong style={{ color: "#374151" }}>{total}</strong> recordatorios
                                    </span>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        {page !== 1 && <button onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: "5px 12px", borderRadius: 7, border: "1.5px solid #E5E7EB", background: page === 1 ? "#F9FAFB" : "#fff", color: page === 1 ? "#D1D5DB" : "#374151", fontSize: 13, fontWeight: 500, cursor: page === 1 ? "default" : "pointer" }}>← Anterior</button>}
                                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                                            .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                                            .reduce<(number | "...")[]>((acc, n, idx, arr) => {
                                                if (idx > 0 && n - (arr[ idx - 1 ] as number) > 1) acc.push("...");
                                                acc.push(n);
                                                return acc;
                                            }, [])
                                            .map((item, idx) =>
                                                item === "..." ? (
                                                    <span key={`ellipsis-${idx}`} style={{ fontSize: 13, color: "#9CA3AF", padding: "0 4px" }}>…</span>
                                                ) : (
                                                    <button key={item} onClick={() => setPage(item as number)} style={{ width: 32, height: 32, borderRadius: 7, border: "1.5px solid", borderColor: page === item ? "#1E3A5F" : "#E5E7EB", background: page === item ? "#1E3A5F" : "#fff", color: page === item ? "#fff" : "#374151", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{item}</button>
                                                )
                                            )
                                        }
                                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "5px 12px", borderRadius: 7, border: "1.5px solid #E5E7EB", background: page === totalPages ? "#F9FAFB" : "#fff", color: page === totalPages ? "#D1D5DB" : "#374151", fontSize: 13, fontWeight: 500, cursor: page === totalPages ? "default" : "pointer" }}>Siguiente →</button>
                                    </div>
                                </>
                            }
                        />
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
                <EditScheduledReminderModal reminder={editReminder} onClose={() => setEditReminder(null)} onSaved={fetchReminders} />
            )}
            {viewReminder && (
                <ReminderDrawer
                    reminder={viewReminder}
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
                />
            )}
        </>
    );
}
