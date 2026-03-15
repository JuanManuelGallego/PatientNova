export function StatCard({ label, value, sub, accent }: {
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
