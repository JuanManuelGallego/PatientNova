"use client";

import Sidebar from '../../components/Sidebar';

export default function SettingsPage() {
    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 3px; }
      `}</style>

            <div style={{ display: "flex", minHeight: "100vh", background: "#F8F7F4", fontFamily: "'DM Sans', sans-serif" }}>

                <Sidebar />

                <main style={{ marginLeft: 240, flex: 1, padding: "36px 40px", maxWidth: "calc(100% - 240px)" }}>
                    <h1 style={{
                        fontSize: 30, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em",
                        fontFamily: "'Playfair Display', Georgia, serif", marginBottom: 6,
                    }}>
                        Configuración
                    </h1>
                    <p style={{ fontSize: 14, color: "#9CA3AF" }}>
                        Página de configuración - Próximamente
                    </p>
                </main>
            </div>
        </>
    );
}