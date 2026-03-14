"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
    { id: "dashboard", path: "/", icon: "⬛", label: "Panel Principal" },
    { id: "patients", path: "/patients", icon: "👤", label: "Pacientes" },
    { id: "reminders", path: "/reminders", icon: "🔔", label: "Recordatorios" },
    { id: "templates", path: "/templates", icon: "📄", label: "Plantillas" },
    { id: "settings", path: "/settings", icon: "⚙️", label: "Configuración" },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside style={{
            width: 240, background: "#1E3A5F", display: "flex", flexDirection: "column",
            position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50,
        }}>
            {/* Logo */}
            <div style={{ padding: "28px 24px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10, background: "#3B82F6",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 18,
                    }}>🔔</div>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>Notification Service</div>
                        <div style={{ fontSize: 11, color: "#93C5FD", fontWeight: 500 }}>Alertas de Pacientes</div>
                    </div>
                </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "0 16px 16px" }} />

            {/* Nav */}
            <nav style={{ flex: 1, padding: "0 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                {NAV_ITEMS.map(item => {
                    const isActive = pathname === item.path;
                    return (
                        <Link key={item.id} href={item.path} style={{ textDecoration: 'none' }}>
                            <div className={`nav-item ${isActive ? 'active' : ''}`} style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                padding: "10px 14px",
                                borderRadius: 10,
                                fontSize: 14,
                                cursor: "pointer",
                                width: "100%",
                                transition: "all 0.15s",
                                color: isActive ? "#fff" : "rgba(255,255,255,0.55)",
                                borderLeft: isActive ? "3px solid #60A5FA" : "3px solid transparent",
                            }}>
                                <span>{item.icon}</span>
                                {item.label}
                            </div>
                        </Link>
                    );
                })}
            </nav>
            {/* User footer */}
            <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: "50%", background: "#3B82F6",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, color: "#fff",
                    }}>DR</div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Dr. Manuela Cardona</div>
                        <div style={{ fontSize: 11, color: "#93C5FD" }}>Administradora</div>
                    </div>
                </div>
            </div>
        </aside>
    );
}