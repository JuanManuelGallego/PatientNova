export function PayStatusPill({ paid }: { paid: boolean }) {
    return (
        <span className="pill" style={{
            background: paid ? "var(--c-success-bg)" : "var(--c-warning-light)",
            color: paid ? "var(--c-success)" : "var(--c-warning-dark)",
        }}>
            {paid ? "💳 Pagado" : "⏳ Pendiente"}
        </span>
    );
}
