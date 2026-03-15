"use client";;
import { Patient } from '@/src/types/Patient';
import Sidebar from '../../components/Sidebar';
import { useState, useEffect, useCallback } from "react";
import { API_BASE } from '@/src/types/API';
import { ScheduledReminderJob } from '@/src/types/Reminder';
import { btnPrimary, thStyle, tdStyle } from '@/src/styles/theme';
import { fmtDateTime, fmtRelative } from '@/src/utils/TimeUtils';
import { ReminderStatusPill } from '@/src/components/StatusPill';
import { StatCard } from '@/src/components/StatCard';
import { ChannelBadge } from '@/src/components/ChannelIcon';
import { ErrorBanner } from '@/src/components/ErrorBanner';
import { ReminderModal } from '@/src/components/ReminderModal';
import { EditScheduledReminderJobModal } from '@/src/components/EditScheduledReminderJobModal';
import { BulkSendWizard } from '@/src/components/BulkSendWizard';
import { EmptyState } from '@/src/components/EmptyState';

type ActiveTab = "Active" | "History" | "Bulk";

export default function RecordatoriosPage() {
    const [ activeTab, setActiveTab ] = useState<ActiveTab>("Active");
    const [ jobs, setJobs ] = useState<ScheduledReminderJob[]>([]);
    const [ patients, setPatients ] = useState<Patient[]>([]);
    const [ loadingJobs, setLoadingJobs ] = useState(true);
    const [ errorJobs, setErrorJobs ] = useState<string | null>(null);
    const [ showCreate, setShowCreate ] = useState(false);
    const [ editJob, setEditJob ] = useState<ScheduledReminderJob | null>(null);
    const [ search, setSearch ] = useState("");

    const fetchJobs = useCallback(async () => {
        setLoadingJobs(true); setErrorJobs(null);
        try {
            const res = await fetch(`${API_BASE}/notify/schedule`);
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error ?? "Error al cargar recordatorios");
            setJobs(json.data.jobs ?? []);
        } catch (err) {
            setErrorJobs(err instanceof Error ? err.message : "Error desconocido");
        } finally { setLoadingJobs(false); }
    }, []);

    const fetchPatients = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/patients`);
            const json = await res.json();
            if (json.success) setPatients(json.data.data);
        } catch { }
    }, []);

    useEffect(() => { fetchJobs(); fetchPatients(); }, [ fetchJobs, fetchPatients ]);

    async function cancelJob(id: string) {
        try {
            await fetch(`${API_BASE}/notify/schedule/${id}`, { method: "DELETE" });
            fetchJobs();
        } catch { }
    }

    const active = jobs.filter(j => j.status === "pending");
    const history = jobs.filter(j => j.status !== "pending");

    const filteredActive = active.filter(j =>
        !search || (j.to ?? "").includes(search) || j.channel.includes(search)
    );
    const filteredHistory = history.filter(j =>
        !search || (j.to ?? "").includes(search) || j.channel.includes(search)
    );

    const counts = {
        active: active.length,
        sent: jobs.filter(j => j.status === "sent").length,
        failed: jobs.filter(j => j.status === "failed").length,
        cancelled: jobs.filter(j => j.status === "canceled").length,
    };

    const SkeletonRow = () => (
        <tr>
            {[ 160, 100, 140, 120, 80, 90 ].map((w, i) => (
                <td key={i} style={tdStyle}>
                    <div style={{ height: 13, width: w, borderRadius: 6, background: "linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
                </td>
            ))}
        </tr>
    );

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
                    {errorJobs && activeTab !== "Bulk" && <ErrorBanner msg={errorJobs} onRetry={fetchJobs} />}
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
                                    {loadingJobs && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
                                    {!loadingJobs && filteredActive.map((job, i) => (
                                        <tr key={job.id} style={{ borderBottom: i < filteredActive.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                                            <td style={tdStyle}>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{job.to ?? "—"}</div>
                                                <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace" }}>{job.id.slice(0, 10)}…</div>
                                            </td>
                                            <td style={tdStyle}><ChannelBadge channel={job.channel} /></td>
                                            <td style={tdStyle}><ReminderStatusPill status={job.status} /></td>
                                            <td style={{ ...tdStyle, fontSize: 13, color: "#374151" }}>{fmtDateTime(job.sendAt)}</td>
                                            <td style={{ ...tdStyle, fontSize: 13, color: "#6B7280", whiteSpace: "nowrap" }}>
                                                <span style={{ background: "#EFF6FF", color: "#2563EB", padding: "3px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                                                    {fmtRelative(job.sendAt)}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, fontSize: 13, color: "#9CA3AF" }}>{fmtDateTime(job.scheduledAt)}</td>
                                            <td style={tdStyle}>
                                                <div style={{ display: "flex", gap: 6 }}>
                                                    <button onClick={() => setEditJob(job)} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, background: "#EFF6FF", border: "none", borderRadius: 7, color: "#2563EB", cursor: "pointer" }}>
                                                        Reprogramar
                                                    </button>
                                                    <button onClick={() => cancelJob(job.id)} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, background: "#FEF2F2", border: "none", borderRadius: 7, color: "#DC2626", cursor: "pointer" }}>
                                                        Cancelar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {!loadingJobs && filteredActive.length === 0 && (
                                        <EmptyState icon="🔔" title="Sin recordatorios activos" sub="Haz clic en Nuevo Recordatorio para programar el primero." />
                                    )}
                                </tbody>
                            </table>
                            {!loadingJobs && filteredActive.length > 0 && (
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
                                        {[ "Destinatario", "Canal", "Estado", "Programado", "Enviado / Fallado", "ID Mensaje", "Error" ].map(h => (
                                            <th key={h} style={thStyle}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingJobs && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
                                    {!loadingJobs && filteredHistory.map((job, i) => (
                                        <tr key={job.id} style={{ borderBottom: i < filteredHistory.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                                            <td style={tdStyle}>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{job.to ?? "—"}</div>
                                                <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace" }}>{job.id.slice(0, 10)}…</div>
                                            </td>
                                            <td style={tdStyle}><ChannelBadge channel={job.channel} /></td>
                                            <td style={tdStyle}><ReminderStatusPill status={job.status} /></td>
                                            <td style={{ ...tdStyle, fontSize: 13, color: "#6B7280" }}>{fmtDateTime(job.sendAt)}</td>
                                            <td style={{ ...tdStyle, fontSize: 13, color: "#6B7280" }}>{fmtDateTime(job.scheduledAt)}</td>
                                            <td style={{ ...tdStyle, fontSize: 12, color: "#9CA3AF", fontFamily: "monospace" }}>
                                                {job.messageSid ? (
                                                    <span title={job.messageSid}>{job.messageSid.slice(0, 16)}…</span>
                                                ) : "—"}
                                            </td>
                                            <td style={{ ...tdStyle, fontSize: 12, color: "#DC2626", maxWidth: 200 }}>
                                                {job.error
                                                    ? <span title={job.error} style={{ background: "#FEF2F2", padding: "3px 8px", borderRadius: 6 }}>{job.error.slice(0, 40)}{job.error.length > 40 ? "…" : ""}</span>
                                                    : <span style={{ color: "#D1D5DB" }}>—</span>
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                    {!loadingJobs && filteredHistory.length === 0 && (
                                        <EmptyState icon="📋" title="Sin historial aún" sub="Los recordatorios enviados, fallidos y cancelados aparecerán aquí." />
                                    )}
                                </tbody>
                            </table>
                            {!loadingJobs && filteredHistory.length > 0 && (
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
                    <p style={{ marginTop: 24, fontSize: 12, color: "#D1D5DB", textAlign: "center" }}>
                        🔒 Datos del paciente cifrados en reposo · Infraestructura compatible con HIPAA · Todas las acciones quedan registradas en auditoría
                    </p>
                </main>
            </div>
            {showCreate && (
                <ReminderModal patients={patients} onClose={() => setShowCreate(false)} onSaved={fetchJobs} />
            )}
            {editJob && (
                <EditScheduledReminderJobModal job={editJob} onClose={() => setEditJob(null)} onSaved={fetchJobs} />
            )}
        </>
    );
}
