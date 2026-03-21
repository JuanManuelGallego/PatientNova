export function PayBadge({ paid }: { paid: boolean }) {
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: paid ? "#F0FDF4" : "#FEF9C3",
            color: paid ? "#16A34A" : "#92400E",
        }}>
            {paid ? "💳 Pagado" : "⏳ Pendiente"}
        </span>
    );
}