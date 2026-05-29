import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  sub,
  accent,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  sub: string;
  accent: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="stat-card" style={{ borderLeft: `4px solid ${accent}` }}>
      <div className="stat-card__top">
        <span className="stat-card__label">{label}</span>
        {Icon && (
          <span className="stat-card__icon" style={{ color: accent }}>
            <Icon size={18} />
          </span>
        )}
      </div>
      <span className="stat-card__value">{value}</span>
      <span className="stat-card__sub">{sub}</span>
    </div>
  );
}
