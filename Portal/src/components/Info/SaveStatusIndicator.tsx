import { STATUS_ICONS } from "@/src/config/icons";
import { LBL_SAVED, LBL_SAVE_ERROR, LBL_SAVING } from "@/src/constants/ui";

export type SaveStatus = "idle" | "saved" | "error";

interface SaveStatusIndicatorProps {
  saving: boolean;
  status: SaveStatus;
  error?: string | null;
  testId?: string;
}

export function SaveStatusIndicator({ saving, status, error = null, testId = "save-status-indicator" }: SaveStatusIndicatorProps) {
  const state = saving ? "saving" : error || status === "error" ? "error" : status;
  return (
    <span
      role="status"
      aria-live="polite"
      data-testid={testId}
      data-status={state}
      title={state === "error" && error ? error : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        flexShrink: 0,
        minHeight: 20,
        fontSize: 12,
        fontWeight: 400,
        color: state === "error" ? "var(--c-error)" : "var(--c-gray-500)",
      }}
    >
      {state === "saved" && <STATUS_ICONS.success size={12} aria-hidden="true" style={{ color: "var(--c-success)" }} />}
      {state === "error" && <STATUS_ICONS.warning size={12} aria-hidden="true" />}
      {state === "saving" ? LBL_SAVING : state === "saved" ? LBL_SAVED : state === "error" ? LBL_SAVE_ERROR : null}
    </span>
  );
}
