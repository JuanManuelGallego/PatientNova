import { type LucideIcon } from "@/src/config/icons";

export function Section({
  title,
  children,
  testId,
}: {
  title: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div data-testid={testId}>
      <div className="section-title">{title}</div>
      <div className="section-body">{children}</div>
    </div>
  );
}

export function Row({
  icon: Icon,
  label,
  value,
  testId,
}: {
  icon: LucideIcon | null;
  label: string;
  value: React.ReactNode;
  testId?: string;
}) {
  return (
    <div className="detail-row" data-testid={testId}>
      {Icon && (
        <span className="detail-row__icon">
          <Icon size={14} />
        </span>
      )}
      <span className="detail-row__label">{label}</span>
      <span className="detail-row__value">{value}</span>
    </div>
  );
}

export function LinkedCard({
  children,
  onClick,
  style,
  testId,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  testId?: string;
}) {
  const isInteractive = Boolean(onClick);

  return (
    <div
      className={`linked-card${isInteractive ? " linked-card--interactive" : ""}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (isInteractive && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick?.();
        }
      }}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      style={style}
      data-testid={testId}
    >
      {children}
    </div>
  );
}
