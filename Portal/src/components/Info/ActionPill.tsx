import { ActionType, ACTION_TYPE_CONFIG } from "@/src/types/AuditLog";

export function ActionPill({ action }: { action: ActionType }) {
  const c = ACTION_TYPE_CONFIG[action];
  return (
    <span className="pill" style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}
