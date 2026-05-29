import { type LucideIcon } from "@/src/config/icons";

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="section-title">{title}</div>
      <div className="section-body">{children}</div>
    </div>
  );
}

export function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="detail-row">
      <span className="detail-row__icon">
        <Icon size={14} />
      </span>
      <span className="detail-row__label">{label}</span>
      <span className="detail-row__value">{value}</span>
    </div>
  );
}
