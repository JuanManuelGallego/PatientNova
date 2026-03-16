"use client";

import { useState, useEffect, useCallback } from "react";

import Sidebar from '../../components/Sidebar';
import { Patient, PatientStatus } from "@/src/types/Patient";
import { API_BASE, ApiResponse } from "@/src/types/API";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import { btnPrimary } from "@/src/styles/theme";
import { StatCard } from "@/src/components/StatCard";
import { PatientStatusPill } from "@/src/components/StatusPill";
import { ChannelIcon } from "@/src/components/ChannelIcon";
import { SkeletonRow } from "@/src/components/Skeleton";
import { PatientModal } from "@/src/components/PatientModal";
import { DeletePatientModal } from "@/src/components/DeletePatientModal";
import { Channel } from "@/src/types/Reminder";

export default function PatientsPage() {
    const [ patients, setPatients ] = useState<Patient[]>([]);
    const [ loading, setLoading ] = useState(true);
    const [ error, setError ] = useState<string | null>(null);
    const [ search, setSearch ] = useState("");
    const [ filterStatus, setFilterStatus ] = useState<PatientStatus | "ALL">("ALL");
    const [ showCreate, setShowCreate ] = useState(false);
    const [ editPatient, setEditPatient ] = useState<Patient | null>(null);
    const [ deletePatient, setDeletePatient ] = useState<Patient | null>(null);

    const fetchPatients = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/patients`);
            if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);
            const json: ApiResponse = await res.json();
            if (!json.success) throw new Error("La API devolvió un error");
            setPatients(json.data.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al cargar pacientes");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchPatients(); }, [ fetchPatients ]);

    const filtered = patients.filter(p => {
        const matchStatus = filterStatus === "ALL" || p.status === filterStatus;
        const q = search.toLowerCase();
        const matchSearch = !q || [ p.name, p.lastName, p.email ].some(v => v.toLowerCase().includes(q));
        return matchStatus && matchSearch;
    });

    const counts = {
        total: patients.length,
        active: patients.filter(p => p.status === PatientStatus.ACTIVE).length,
        inactive: patients.filter(p => p.status === PatientStatus.INACTIVE).length,
        archived: patients.filter(p => p.status === PatientStatus.ARCHIVED).length,
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
                        <StatCard label="Total Pacientes" value={counts.total} sub="en el sistema" accent="#1E3A5F" />
                        <StatCard label="Activos" value={counts.active} sub="reciben notificaciones" accent="#16A34A" />
                        <StatCard label="Inactivos" value={counts.inactive} sub="sin notificaciones" accent="#D97706" />
                        <StatCard label="Archivados" value={counts.archived} sub="fuera del sistema" accent="#9CA3AF" />
                    </div>
                    <div style={{
                        background: "#fff", borderRadius: 16, padding: "18px 24px",
                        display: "flex", alignItems: "center", gap: 16, marginBottom: 20,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    }}>
                        <input
                            placeholder="Buscar por nombre, apellido o correo…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{
                                flex: 1, padding: "9px 14px", border: "1.5px solid #E5E7EB",
                                borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit",
                                color: "#111827", background: "#FAFAFA",
                            }}
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                            {([
                                { key: "ALL", label: "Todos" },
                                { key: PatientStatus.ACTIVE, label: "Activos" },
                                { key: PatientStatus.INACTIVE, label: "Inactivos" },
                                { key: PatientStatus.ARCHIVED, label: "Archivados" },
                            ] as const).map(({ key, label }) => (
                                <button key={key} onClick={() => setFilterStatus(key)} style={{
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
                            <button onClick={fetchPatients} style={{ ...btnPrimary, background: "#DC2626", padding: "6px 14px", fontSize: 13 }}>
                                Reintentar
                            </button>
                        </div>
                    )}
                    <div style={{
                        background: "#fff", borderRadius: 16,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden",
                        animation: "fadeIn 0.3s ease",
                    }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ background: "#F9FAFB" }}>
                                    {[ "Paciente", "Correo", "WhatsApp", "SMS", "Estado", "Registrado", "" ].map(h => (
                                        <th key={h} style={{
                                            padding: "13px 20px", textAlign: "left",
                                            fontSize: 12, fontWeight: 600, color: "#6B7280",
                                            letterSpacing: "0.05em", textTransform: "uppercase",
                                            borderBottom: "1px solid #F3F4F6", whiteSpace: "nowrap",
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
                                {!loading && filtered.map((p, i) => (
                                    <tr key={p.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #F3F4F6" : "none" }}>
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
                                                <div>
                                                    <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{p.fullName}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: "14px 20px", fontSize: 13, color: "#374151" }}>
                                            <a href={`mailto:${p.email}`} style={{ color: "#2563EB", textDecoration: "none" }}>{p.email}</a>
                                        </td>
                                        <td style={{ padding: "14px 20px" }}>
                                            <ChannelIcon type={Channel.WHATSAPP} value={p.whatsappNumber} />
                                        </td>
                                        <td style={{ padding: "14px 20px" }}>
                                            <ChannelIcon type={Channel.SMS} value={p.smsNumber} />
                                        </td>
                                        <td style={{ padding: "14px 20px" }}>
                                            <PatientStatusPill status={p.status} />
                                        </td>
                                        <td style={{ padding: "14px 20px", fontSize: 13, color: "#6B7280", whiteSpace: "nowrap" }}>
                                            {new Date(p.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                                        </td>
                                        <td style={{ padding: "14px 20px" }}>
                                            <div style={{ display: "flex", gap: 6 }}>
                                                <button onClick={() => setEditPatient(p)} style={{
                                                    padding: "5px 12px", fontSize: 12, fontWeight: 600,
                                                    background: "#EFF6FF", border: "none", borderRadius: 7,
                                                    color: "#2563EB", cursor: "pointer",
                                                }}>Editar</button>
                                                <button onClick={() => setDeletePatient(p)} style={{
                                                    padding: "5px 12px", fontSize: 12, fontWeight: 600,
                                                    background: "#FEF2F2", border: "none", borderRadius: 7,
                                                    color: "#DC2626", cursor: "pointer",
                                                }}>Eliminar</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {!loading && !error && filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={7} style={{ padding: 56, textAlign: "center" }}>
                                            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                                            <div style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                                                {search || filterStatus !== "ALL" ? "Sin resultados" : "No hay pacientes aún"}
                                            </div>
                                            <div style={{ fontSize: 13, color: "#9CA3AF" }}>
                                                {search || filterStatus !== "ALL"
                                                    ? "Prueba ajustando los filtros de búsqueda."
                                                    : "Haz clic en \"Nuevo Paciente\" para agregar el primero."}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        {!loading && filtered.length > 0 && (
                            <div style={{
                                padding: "12px 20px", borderTop: "1px solid #F3F4F6",
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                background: "#FAFAFA",
                            }}>
                                <span style={{ fontSize: 13, color: "#9CA3AF" }}>
                                    Mostrando <strong style={{ color: "#374151" }}>{filtered.length}</strong> de <strong style={{ color: "#374151" }}>{patients.length}</strong> pacientes
                                </span>
                                <span style={{ fontSize: 12, color: "#D1D5DB" }}>
                                    Última actualización: {new Date().toLocaleTimeString("es-ES")}
                                </span>
                            </div>
                        )}
                    </div>
                </main>
            </div>
            {showCreate && (
                <PatientModal
                    onClose={() => setShowCreate(false)}
                    onSaved={fetchPatients}
                />
            )}
            {editPatient && (
                <PatientModal
                    patient={editPatient}
                    onClose={() => setEditPatient(null)}
                    onSaved={fetchPatients}
                />
            )}
            {deletePatient && (
                <DeletePatientModal
                    patient={deletePatient}
                    onClose={() => setDeletePatient(null)}
                    onDeleted={fetchPatients}
                />
            )}
        </>
    );
}
