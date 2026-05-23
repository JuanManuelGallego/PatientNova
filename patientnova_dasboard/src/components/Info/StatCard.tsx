export function StatCard({ label, value, sub, accent }: {
    label: string; value: number | string; sub: string; accent: string;
}) {
    return (
        <div className="stat-card" style={{ borderLeft: `4px solid ${accent}` }}>
            <span className="stat-card__label">{label}</span>
            <span className="stat-card__value">{value}</span>
            <span className="stat-card__sub">{sub}</span>
        </div>
    );
}

