import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";

export function StatCard({
  label,
  value,
  sub,
  accent,
  icon: Icon,
}: {
  label: string;
  value: number | string | undefined;
  sub: string;
  accent: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="stat-card" data-testid={label ? `stat-card-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined}>
      <div className="stat-card__inner">
        <div className="stat-card__top">
          <span className="stat-card__label">{label}</span>
          {Icon && (
            <span className="stat-card__icon" style={{ color: accent }}>
              <Icon size={18} />
            </span>
          )}
        </div>
        <span
          className="stat-card__value"
          style={{ "--stat-chars": String(value ?? "—").length } as CSSProperties}
        >
          {value ?? "—"}
        </span>
        <span className="stat-card__sub">{sub}</span>
      </div>
    </div>
  );
}
