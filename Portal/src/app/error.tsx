"use client";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            background: "var(--c-bg)",
            gap: 16,
            padding: 24,
        }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--c-text)" }}>
                Algo salió mal
            </h2>
            <p style={{ color: "var(--c-text-sub)", fontSize: 14, textAlign: "center" }}>
                {error.message || "Ocurrió un error inesperado."}
            </p>
            <button
                onClick={reset}
                style={{
                    padding: "8px 20px",
                    background: "var(--c-brand)",
                    color: "var(--c-white)",
                    border: "none",
                    borderRadius: "var(--r-md)",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 14,
                }}
            >
                Reintentar
            </button>
        </div>
    );
}
