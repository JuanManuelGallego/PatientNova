import { btnPrimary } from "../styles/theme";

export function ErrorBanner({ msg, onRetry }: { msg: string; onRetry: () => void }) {
    return (
        <div style={{
            background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 12,
            padding: "14px 20px", marginBottom: 20,
            display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
            <span style={{ fontSize: 14, color: "#DC2626" }}>⚠️ {msg}</span>
            <button onClick={onRetry} style={{ ...btnPrimary, background: "#DC2626", padding: "6px 14px", fontSize: 13 }}>Reintentar</button>
        </div>
    );
}