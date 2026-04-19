"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuthContext } from '@/src/app/AuthContext';
import { useRouter } from "next/navigation";

export const NAV_ITEMS = [
    { id: "dashboard", path: "/dashboard", icon: "🏠", label: "Vista General" },
    { id: "patients", path: "/patients", icon: "🪪", label: "Pacientes" },
    { id: "medical-records", path: "/medical-records", icon: "📋", label: "Historias Clinicas" },
    { id: "appointments", path: "/appointments", icon: "📝", label: "Citas" },
    { id: "calendar", path: "/calendar", icon: "📆", label: "Calendario" },
    { id: "reminders", path: "/reminders", icon: "🔔", label: "Recordatorios" },
    { id: "settings", path: "/settings", icon: "⚙️", label: "Configuración" },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuthContext();

    return (
        <aside className="sidebar">
            <div style={{ padding: "28px 24px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Image src="/favicon.ico" alt="Patient Nova" width={36} height={36} style={{ borderRadius: "var(--r-lg)" }} />
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--c-white)", letterSpacing: "-0.01em" }}>Patient Nova</div>
                        <div style={{ fontSize: 11, color: "var(--c-brand-sub)", fontWeight: 500 }}>Gestión de pacientes</div>
                    </div>
                </div>
            </div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "0 16px 16px" }} />
            <nav style={{ flex: 1, padding: "0 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                {NAV_ITEMS.map(item => {
                    const isActive = pathname === item.path;
                    return (
                        <Link key={item.id} href={item.path} style={{ textDecoration: 'none' }}>
                            <div className={`nav-item ${isActive ? 'active' : ''}`}>
                                <span>{item.icon}</span>
                                {item.label}
                            </div>
                        </Link>
                    );
                })}
            </nav>
            <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Avatar */}
                    <div style={{
                        flexShrink: 0,
                        width: 38, height: 38, borderRadius: "50%", background: "var(--c-brand-accent)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 700, color: "var(--c-white)",
                        overflow: "hidden",
                    }}>
                        {user?.avatarUrl ?
                            <Image src={user.avatarUrl} alt={user.displayName} width={36} height={36} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : user ? (
                                `${user.firstName[ 0 ]}${user.lastName[ 0 ]}`.toUpperCase()
                            ) : "?"}
                    </div>

                    {/* Text Container */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--c-white)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}>
                            {user?.displayName ?? "—"}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--c-brand-sub)" }}>
                            {user?.jobTitle ?? ""}
                        </div>
                    </div>

                    {/* Logout Icon Button */}
                    <button
                        onClick={async () => { await logout(); router.replace("/login"); }}
                        title="Cerrar sesión"
                        style={{
                            flexShrink: 0,
                            background: "rgba(255,255,255,0.05)",
                            border: "none",
                            borderRadius: "8px",
                            width: "32px",
                            height: "32px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            color: "#ff4d4d",
                            transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,77,77,0.15)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                    >
                        <span style={{ fontSize: '16px' }}>➜]</span> {/* Or use a Logout Icon from a library */}
                    </button>
                </div>
            </div>
        </aside>
    );
}