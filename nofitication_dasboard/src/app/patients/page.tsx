"use client";;
import { useState, useMemo } from "react";

import Sidebar from '../../components/Navigation/Sidebar';
import { FetchPatientsFilters, Patient, PatientStatus } from "@/src/types/Patient";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import { btnPrimary } from "@/src/styles/theme";
import { StatCard } from "@/src/components/Info/StatCard";
import { ChannelIcon } from "@/src/components/Info/ChannelIcon";
import { DataTable } from "@/src/components/DataTable";
import { PatientModal } from "@/src/components/Modals/PatientModal";
import { ArchivePatientModal } from "@/src/components/Modals/ArchivedPatientModal";
import { Channel } from "@/src/types/Reminder";
import { useFetchPatients } from "@/src/api/useFetchPatients";
import { PatientDrawer } from "@/src/components/Drawers/PatientDrawer";
import { PatientStatusPill } from "@/src/components/Info/StatusPill";
import { useDebounceState } from "@/src/utils/useDebounceState";
import { useFetchPatientsStats } from "@/src/api/useFetchPatientsStats";

const PAGE_SIZE = 10;

export default function PatientsPage() {
    const [ search, setSearch ] = useState("");
    const debouncedSearch = useDebounceState(search, 250);
    const [ filterStatus, setFilterStatus ] = useState<PatientStatus | "ALL">("ALL");
    const [ page, setPage ] = useState(1);
    const [ showCreate, setShowCreate ] = useState(false);
    const [ editPatient, setEditPatient ] = useState<Patient | null>(null);
    const [ deletePatient, setDeletePatient ] = useState<Patient | null>(null);
    const [ viewPatient, setViewPatient ] = useState<Patient | null>(null);
    const { stats, fetchStats } = useFetchPatientsStats();

    const filters = useMemo<FetchPatientsFilters>(() => ({
        search: debouncedSearch,
        status: filterStatus !== "ALL" ? filterStatus : undefined,
        page,
        pageSize: PAGE_SIZE,
        orderBy: 'name',
        order: 'asc',
    }), [ debouncedSearch, filterStatus, page ]);

    const { patients, loading, error, fetchPatients, total, totalPages } = useFetchPatients(filters);

    return (
        <>
            <div style={{ display: "flex", minHeight: "100vh", background: "#F8F7F4", fontFamily: "'DM Sans', sans-serif" }}>
                <Sidebar />
                <main style={{ marginLeft: 240, flex: 1, padding: "36px 40px", maxWidth: "calc(100% - 240px)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 36 }}>
                        <div>
                            <h1 style={{ fontSize: 30, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em", fontFamily: "'Playfair Display', Georgia, serif", marginBottom: 6 }}>
                                Pacientes
                            </h1>
                            <p style={{ fontSize: 14, color: "#9CA3AF" }}>
                                {new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                            </p>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setShowCreate(true)} style={{
                                ...btnPrimary,
                                display: "flex", alignItems: "center", gap: 8,
                                boxShadow: "0 4px 14px rgba(30,58,95,0.3)",
                                padding: "12px 24px",
                            }}>
                                <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Nuevo Paciente
                            </button>
                        </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 36 }}>
                        <StatCard label="Total Pacientes" value={stats?.total ?? 0} sub="en el sistema" accent="#1E3A5F" />
                        <StatCard label="Activos" value={stats?.byStatus[ PatientStatus.ACTIVE ] ?? 0} sub="reciben notificaciones" accent="#16A34A" />
                        <StatCard label="Inactivos" value={stats?.byStatus[ PatientStatus.INACTIVE ] ?? 0} sub="sin notificaciones" accent="#D97706" />
                    </div>
                    <div style={{
                        background: "#fff", borderRadius: 16, padding: "18px 24px",
                        display: "flex", alignItems: "center", gap: 16, marginBottom: 20,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    }}>
                        <div style={{ position: "relative", flex: 1 }}>
                            <input
                                placeholder="Buscar por nombre, apellido o correo…"
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                autoComplete="new-password"
                                style={{
                                    width: "100%", padding: "9px 36px 9px 14px", border: "1.5px solid #E5E7EB",
                                    borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit",
                                    color: "#111827", background: "#FAFAFA", boxSizing: "border-box",
                                }}
                            />
                            <button
                                onClick={() => { setSearch(""); setPage(1); }}
                                style={{
                                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                                    background: "none", border: "none", cursor: "pointer",
                                    color: "#9CA3AF", fontSize: 16, lineHeight: 1, padding: 2,
                                }}
                                aria-label="Limpiar búsqueda"
                            >✕</button>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            {([
                                { key: "ALL", label: "Todos" },
                                { key: PatientStatus.ACTIVE, label: "Activos" },
                                { key: PatientStatus.INACTIVE, label: "Inactivos" },
                            ] as const).map(({ key, label }) => (
                                <button key={key} onClick={() => { setFilterStatus(key); setPage(1); }} style={{
                                    padding: "7px 14px", borderRadius: 8, border: "1.5px solid",
                                    borderColor: filterStatus === key ? "#1E3A5F" : "#E5E7EB",
                                    background: filterStatus === key ? "#1E3A5F" : "#fff",
                                    color: filterStatus === key ? "#fff" : "#6B7280",
                                    fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
                                }}>{label}</button>
                            ))}
                        </div>
                    </div>
                    {error && (
                        <div style={{
                            background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 12,
                            padding: "16px 20px", marginBottom: 20,
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                        }}>
                            <span style={{ fontSize: 14, color: "#DC2626" }}>⚠️ {error}</span>
                            <button onClick={() => fetchPatients()} style={{ ...btnPrimary, background: "#DC2626", padding: "6px 14px", fontSize: 13 }}>
                                Reintentar
                            </button>
                        </div>
                    )}
                    <DataTable
                        columns={[ "Paciente", "Correo", "WhatsApp", "SMS", "Estado", "Registrado", "" ]}
                        rows={patients}
                        loading={loading}
                        skeletonCount={5}
                        renderRow={(p, i) => (
                            <tr onClick={() => setViewPatient(p)} key={p.id} style={{ borderBottom: i < patients.length - 1 ? "1px solid #F3F4F6" : "none", cursor: "pointer" }}>
                                <td style={{ padding: "14px 20px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{
                                            width: 38, height: 38, borderRadius: "50%",
                                            background: getAvatarColor(p.id),
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: 13, fontWeight: 700, color: "#1E3A5F", flexShrink: 0,
                                        }}>
                                            {getInitials(p.name, p.lastName)}
                                        </div>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{p.name} {p.lastName}</div>
                                    </div>
                                </td>
                                <td style={{ padding: "14px 20px", fontSize: 13, color: "#374151" }}>
                                    {p.email
                                        ? <a href={`mailto:${p.email}`} style={{ color: "#2563EB", textDecoration: "none" }}>{p.email}</a>
                                        : <span style={{ fontSize: 11, color: "#828383" }}><span style={{ textDecoration: "line-through", opacity: 0.5 }}>—</span></span>}
                                </td>
                                <td style={{ padding: "14px 20px" }}><ChannelIcon type={Channel.WHATSAPP} value={p.whatsappNumber} /></td>
                                <td style={{ padding: "14px 20px" }}><ChannelIcon type={Channel.SMS} value={p.smsNumber} /></td>
                                <td style={{ padding: "14px 20px" }}><PatientStatusPill status={p.status} /></td>
                                <td style={{ padding: "14px 20px", fontSize: 13, color: "#6B7280", whiteSpace: "nowrap" }}>
                                    {new Date(p.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                                </td>
                                <td style={{ padding: "14px 20px" }}>
                                    <div style={{ display: "flex", gap: 6 }}>
                                        <button onClick={e => { e.stopPropagation(); setEditPatient(p); }} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, background: "#EFF6FF", border: "none", borderRadius: 7, color: "#2563EB", cursor: "pointer" }}>Editar</button>
                                        <button onClick={e => { e.stopPropagation(); setDeletePatient(p); }} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, background: "#FEF2F2", border: "none", borderRadius: 7, color: "#DC2626", cursor: "pointer" }}>Eliminar</button>
                                    </div>
                                </td>
                            </tr>
                        )}
                        emptyState={
                            <>
                                <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                                <div style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                                    {search || filterStatus !== "ALL" ? "Sin resultados" : "No hay pacientes aún"}
                                </div>
                                <div style={{ fontSize: 13, color: "#9CA3AF" }}>
                                    {search || filterStatus !== "ALL"
                                        ? "Prueba ajustando los filtros de búsqueda."
                                        : "Haz clic en \"Nuevo Paciente\" para agregar el primero."}
                                </div>
                            </>
                        }
                        footer={
                            <>
                                <span style={{ fontSize: 13, color: "#9CA3AF" }}>
                                    Mostrando <strong style={{ color: "#374151" }}>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}</strong> de <strong style={{ color: "#374151" }}>{total}</strong> pacientes
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
                </main>
            </div>
            {showCreate && (
                <PatientModal
                    onClose={() => setShowCreate(false)}
                    onSaved={() => { fetchPatients(); fetchStats(); }}
                />
            )}
            {editPatient && (
                <PatientModal
                    patient={editPatient}
                    onClose={() => setEditPatient(null)}
                    onSaved={() => { fetchPatients(); fetchStats(); }}
                />
            )}
            {deletePatient && (
                <ArchivePatientModal
                    patient={deletePatient}
                    onClose={() => setDeletePatient(null)}
                    onDeleted={() => { fetchPatients(); fetchStats(); }}
                />
            )}
            {viewPatient && (
                <PatientDrawer
                    patient={viewPatient}
                    onClose={() => setViewPatient(null)}
                    onDelete={() => { setDeletePatient(viewPatient); setViewPatient(null) }}
                    onEdit={() => { setEditPatient(viewPatient); setViewPatient(null) }}
                />
            )}
        </>
    );
}
