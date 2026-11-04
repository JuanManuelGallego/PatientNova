import { ActionType, ACTION_TYPE_CONFIG, UNKNOWN_PILL_STYLE } from "@/src/types/AuditLog";

export function ActionPill({ action }: { action: ActionType }) {
  const c = ACTION_TYPE_CONFIG[action] ?? { label: action, ...UNKNOWN_PILL_STYLE };
  return (
    <span className="pill" style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}
