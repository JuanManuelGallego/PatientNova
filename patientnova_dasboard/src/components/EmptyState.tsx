import { type LucideIcon } from "@/src/config/icons";

export function EmptyState({
  icon: Icon,
  title,
  sub,
  action,
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <Icon size={40} />
      </div>
      <div className="empty-state__title">{title}</div>
      <div className="empty-state__sub">{sub}</div>
      {action && <div>{action}</div>}
    </div>
  );
}
