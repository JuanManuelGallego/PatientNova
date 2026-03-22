"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export const NAV_ITEMS = [
    { id: "dashboard", path: "/", icon: "🏠", label: "Vista General" },
    { id: "patients", path: "/patients", icon: "🪪", label: "Pacientes" },
    { id: "appointments", path: "/appointments", icon: "📝", label: "Citas" },
    { id: "calendar", path: "/calendar", icon: "📆", label: "Calendario" },
    { id: "reminders", path: "/reminders", icon: "🔔", label: "Recordatorios" },
    { id: "templates", path: "/templates", icon: "📄", label: "Plantillas" },
    { id: "settings", path: "/settings", icon: "⚙️", label: "Configuración" },
];

export default function Sidebar() {
    const pathname = usePathname();

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
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: "50%", background: "var(--c-brand-accent)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, color: "var(--c-white)",
                    }}>DR</div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--c-white)" }}>Dr. Manuela Cardona</div>
                        <div style={{ fontSize: 11, color: "var(--c-brand-sub)" }}>Administradora</div>
                    </div>
                </div>
            </div>
        </aside>
    );
}