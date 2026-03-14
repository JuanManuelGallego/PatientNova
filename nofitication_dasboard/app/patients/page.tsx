"use client";

import { useState, useEffect, useCallback } from "react";

import Sidebar from '../components/Sidebar';

// ─── Types ────────────────────────────────────────────────────────────────────

type PatientStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

interface Patient {
    id: string;
    name: string;
    lastName: string;
    whatsappNumber: string | null;
    smsNumber: string | null;
    email: string;
    status: PatientStatus;
    createdAt: string;
    updatedAt: string;
}

interface ApiResponse {
    success: boolean;
    data: {
        data: Patient[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    };
    timestamp: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:3001";

const STATUS_CONFIG: Record<PatientStatus, { label: string; color: string; bg: string }> = {
    ACTIVE: { label: "Activo", color: "#16A34A", bg: "#F0FDF4" },
    INACTIVE: { label: "Inactivo", color: "#D97706", bg: "#FFFBEB" },
    ARCHIVED: { label: "Archivado", color: "#df4429", bg: "#f541412f" },
};

// ─── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    padding: "10px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10,
    fontSize: 14, color: "#111827", outline: "none", background: "#FAFAFA",
    fontFamily: "inherit", width: "100%",
};

const labelStyle: React.CSSProperties = {
    display: "flex", flexDirection: "column", gap: 6,
    fontSize: 13, fontWeight: 600, color: "#374151",
};

const btnPrimary: React.CSSProperties = {
    padding: "10px 22px", background: "#1E3A5F", color: "#fff",
    border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
    cursor: "pointer", letterSpacing: "0.01em",
};

const btnSecondary: React.CSSProperties = {
    padding: "10px 22px", background: "#F3F4F6", color: "#374151",
    border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
};

// ─── Avatar helper ────────────────────────────────────────────────────────────

function getInitials(name: string, lastName: string) {
    return `${name.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getAvatarColor(id: string) {
    const hues = [ 200, 160, 280, 30, 340, 60, 240 ];
    const idx = id.charCodeAt(0) % hues.length;
    return `hsl(${hues[ idx ]}, 55%, 82%)`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: {
    label: string; value: number | string; sub: string; accent: string;
}) {
    return (
        <div style={{
            background: "#fff", borderRadius: 16, padding: "24px 28px",
            borderLeft: `4px solid ${accent}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
            display: "flex", flexDirection: "column", gap: 6,
        }}>
            <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</span>
            <span style={{ fontSize: 36, fontWeight: 700, color: "#111827", lineHeight: 1, fontFamily: "'Playfair Display', Georgia, serif" }}>{value}</span>
            <span style={{ fontSize: 13, color: "#9CA3AF" }}>{sub}</span>
        </div>
    );
}

function StatusPill({ status }: { status: PatientStatus }) {
    const c = STATUS_CONFIG[ status ];
    return (
        <span style={{
            display: "inline-block", padding: "3px 12px", borderRadius: 20,
            background: c.bg, color: c.color, fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
        }}>
            {c.label}
        </span>
    );
}

function ChannelIcon({ type, value }: { type: "whatsapp" | "sms" | "email"; value: string | null }) {
    const icons = { whatsapp: "💬", sms: "📱", email: "✉️" };
    if (!value) {
        return (
            <span style={{ fontSize: 11, color: "#828383", display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ textDecoration: "line-through", opacity: 0.5 }}>—</span>
            </span>
        );
    }
    return (
        <span title={value} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 10px", borderRadius: 20,
            background: "#F3F4F6", fontSize: 12, fontWeight: 500, color: "#374151",
        }}>
            {icons[ type ]} {value}
        </span>
    );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonRow() {
    return (
        <tr>
            {[ 180, 120, 200, 140, 140, 80, 60 ].map((w, i) => (
                <td key={i} style={{ padding: "16px 20px" }}>
                    <div style={{
                        height: 14, width: w, borderRadius: 6,
                        background: "linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)",
                        backgroundSize: "200% 100%",
                        animation: "shimmer 1.4s infinite",
                    }} />
                </td>
            ))}
        </tr>
    );
}

// ─── Patient Form Modal ───────────────────────────────────────────────────────

function PatientModal({
    onClose,
    onSaved,
    patient,
}: {
    onClose: () => void;
    onSaved: () => void;
    patient?: Patient;
}) {
    const isEdit = !!patient;
    const [ saving, setSaving ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const [ form, setForm ] = useState({
        name: patient?.name ?? "",
        lastName: patient?.lastName ?? "",
        email: patient?.email ?? "",
        whatsappNumber: patient?.whatsappNumber ?? "",
        smsNumber: patient?.smsNumber ?? "",
        status: patient?.status ?? "ACTIVE" as PatientStatus,
    });

    const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(f => ({ ...f, [ field ]: e.target.value }));

    async function handleSubmit() {
        setSaving(true);
        setError(null);
        try {
            const url = isEdit ? `${API_BASE}/patients/${patient!.id}` : `${API_BASE}/patients`;
            const method = isEdit ? "PATCH" : "POST";
            const body = {
                ...form,
                whatsappNumber: form.whatsappNumber || undefined,
                smsNumber: form.smsNumber || undefined,
            };

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.error ?? "Error al guardar el paciente");
            }

            onSaved();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(17,24,39,0.55)", backdropFilter: "blur(4px)",
            zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={onClose}>
            <div style={{
                background: "#fff", borderRadius: 20, padding: 36,
                width: 560, maxWidth: "calc(100vw - 40px)",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
                    <div>
                        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>
                            {isEdit ? "Editar Paciente" : "Nuevo Paciente"}
                        </h2>
                        <p style={{ fontSize: 13, color: "#9CA3AF", margin: "4px 0 0" }}>
                            {isEdit ? `Modificando: ${patient!.name} ${patient!.lastName}` : "Registrar un nuevo paciente en el sistema"}
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#6B7280" }}>✕</button>
                </div>

                {/* Error banner */}
                {error && (
                    <div style={{
                        background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10,
                        padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#DC2626",
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* Form */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <label style={labelStyle}>
                            Nombre
                            <input style={inputStyle} value={form.name} onChange={set("name")} placeholder="ej. María" />
                        </label>
                        <label style={labelStyle}>
                            Apellido
                            <input style={inputStyle} value={form.lastName} onChange={set("lastName")} placeholder="ej. García" />
                        </label>
                    </div>

                    <label style={labelStyle}>
                        Correo electrónico
                        <input style={inputStyle} type="email" value={form.email} onChange={set("email")} placeholder="paciente@ejemplo.com" />
                    </label>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <label style={labelStyle}>
                            💬 WhatsApp <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(opcional)</span>
                            <input style={inputStyle} value={form.whatsappNumber} onChange={set("whatsappNumber")} placeholder="+15551234567" />
                        </label>
                        <label style={labelStyle}>
                            📱 SMS <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(opcional)</span>
                            <input style={inputStyle} value={form.smsNumber} onChange={set("smsNumber")} placeholder="+15551234567" />
                        </label>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 28 }}>
                    <button onClick={onClose} style={btnSecondary} disabled={saving}>Cancelar</button>
                    <button onClick={handleSubmit} disabled={saving} style={{
                        ...btnPrimary,
                        opacity: saving ? 0.7 : 1,
                        display: "flex", alignItems: "center", gap: 8,
                    }}>
                        {saving ? "Guardando…" : isEdit ? "Guardar Cambios" : "Crear Paciente"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({ patient, onClose, onDeleted }: {
    patient: Patient; onClose: () => void; onDeleted: () => void;
}) {
    const [ deleting, setDeleting ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    async function handleDelete() {
        setDeleting(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/patients/${patient.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error ?? "Error al eliminar");
            onDeleted();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
            setDeleting(false);
        }
    }

    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(17,24,39,0.55)", backdropFilter: "blur(4px)",
            zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={onClose}>
            <div style={{
                background: "#fff", borderRadius: 20, padding: 36, width: 440, maxWidth: "calc(100vw - 40px)",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            }} onClick={e => e.stopPropagation()}>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <div style={{ fontSize: 44, marginBottom: 12 }}>🗑️</div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 8px", fontFamily: "'Playfair Display', Georgia, serif" }}>
                        Eliminar Paciente
                    </h2>
                    <p style={{ fontSize: 14, color: "#6B7280", margin: 0 }}>
                        ¿Estás seguro que deseas eliminar a <strong>{patient.name} {patient.lastName}</strong>? Esta acción no se puede deshacer.
                    </p>
                </div>
                {error && (
                    <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#DC2626" }}>
                        ⚠️ {error}
                    </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={onClose} style={{ ...btnSecondary, flex: 1 }} disabled={deleting}>Cancelar</button>
                    <button onClick={handleDelete} disabled={deleting} style={{
                        flex: 1, padding: "10px 22px", background: "#DC2626", color: "#fff",
                        border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
                        cursor: "pointer", opacity: deleting ? 0.7 : 1,
                    }}>
                        {deleting ? "Eliminando…" : "Sí, eliminar"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PacientesPage() {
    const [ patients, setPatients ] = useState<Patient[]>([]);
    const [ loading, setLoading ] = useState(true);
    const [ error, setError ] = useState<string | null>(null);
    const [ search, setSearch ] = useState("");
    const [ filterStatus, setFilterStatus ] = useState<PatientStatus | "ALL">("ALL");
    const [ showCreate, setShowCreate ] = useState(false);
    const [ editPatient, setEditPatient ] = useState<Patient | null>(null);
    const [ deletePatient, setDeletePatient ] = useState<Patient | null>(null);

    // ── Fetch ──────────────────────────────────────────────────────────────────

    const fetchPatients = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/patients?pageSize=100`);
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

    // ── Derived data ──────────────────────────────────────────────────────────

    const filtered = patients.filter(p => {
        const matchStatus = filterStatus === "ALL" || p.status === filterStatus;
        const q = search.toLowerCase();
        const matchSearch = !q || [ p.name, p.lastName, p.email ].some(v => v.toLowerCase().includes(q));
        return matchStatus && matchSearch;
    });

    const counts = {
        total: patients.length,
        active: patients.filter(p => p.status === "ACTIVE").length,
        inactive: patients.filter(p => p.status === "INACTIVE").length,
        archived: patients.filter(p => p.status === "ARCHIVED").length,
    };

    // ── Render ────────────────────────────────────────────────────────────────

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

                {/* ── Main ────────────────────────────────────────────────────────── */}
                <main style={{ marginLeft: 240, flex: 1, padding: "36px 40px", maxWidth: "calc(100% - 240px)" }}>

                    {/* Page Header */}
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

                    {/* Stat Cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 36 }}>
                        <StatCard label="Total Pacientes" value={counts.total} sub="en el sistema" accent="#1E3A5F" />
                        <StatCard label="Activos" value={counts.active} sub="reciben notificaciones" accent="#16A34A" />
                        <StatCard label="Inactivos" value={counts.inactive} sub="sin notificaciones" accent="#D97706" />
                        <StatCard label="Archivados" value={counts.archived} sub="fuera del sistema" accent="#9CA3AF" />
                    </div>

                    {/* Filters */}
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
                                { key: "ACTIVE", label: "Activos" },
                                { key: "INACTIVE", label: "Inactivos" },
                                { key: "ARCHIVED", label: "Archivados" },
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

                    {/* Error banner */}
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

                    {/* Table */}
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
                                {/* Skeleton while loading */}
                                {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

                                {/* Rows */}
                                {!loading && filtered.map((p, i) => (
                                    <tr key={p.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #F3F4F6" : "none"}}>

                                        {/* Patient name + avatar */}
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
                                                    <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{p.name} {p.lastName}</div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Email */}
                                        <td style={{ padding: "14px 20px", fontSize: 13, color: "#374151" }}>
                                            <a href={`mailto:${p.email}`} style={{ color: "#2563EB", textDecoration: "none" }}>{p.email}</a>
                                        </td>

                                        {/* WhatsApp */}
                                        <td style={{ padding: "14px 20px" }}>
                                            <ChannelIcon type="whatsapp" value={p.whatsappNumber} />
                                        </td>

                                        {/* SMS */}
                                        <td style={{ padding: "14px 20px" }}>
                                            <ChannelIcon type="sms" value={p.smsNumber} />
                                        </td>

                                        {/* Status */}
                                        <td style={{ padding: "14px 20px" }}>
                                            <StatusPill status={p.status} />
                                        </td>

                                        {/* Created at */}
                                        <td style={{ padding: "14px 20px", fontSize: 13, color: "#6B7280", whiteSpace: "nowrap" }}>
                                            {new Date(p.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                                        </td>

                                        {/* Actions */}
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

                                {/* Empty state */}
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

                        {/* Pagination footer */}
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

                    {/* Footer */}
                    <p style={{ marginTop: 20, fontSize: 12, color: "#D1D5DB", textAlign: "center" }}>
                        🔒 Datos del paciente cifrados en reposo · Infraestructura compatible con HIPAA · Todas las acciones quedan registradas en auditoría
                    </p>
                </main>
            </div>

            {/* Modals */}
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
                <DeleteModal
                    patient={deletePatient}
                    onClose={() => setDeletePatient(null)}
                    onDeleted={fetchPatients}
                />
            )}
        </>
    );
}
