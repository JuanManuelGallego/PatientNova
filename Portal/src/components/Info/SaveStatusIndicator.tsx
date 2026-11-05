import { STATUS_ICONS } from "@/src/config/icons";
import { LBL_SAVED, LBL_SAVE_ERROR, LBL_SAVING } from "@/src/constants/ui";

export type SaveStatus = "idle" | "saved" | "error";

interface SaveStatusIndicatorProps {
  saving: boolean;
  status: SaveStatus;
  /** A failed save's message; while set the indicator stays on "Error al guardar" (the message is its tooltip). */
  error?: string | null;
  testId?: string;
}

/**
 * The app's one autosave label, placed in the header of the card being edited: "Guardando…" while a save is in
 * flight, "✓ Guardado" for a moment after, and "Error al guardar" until the next successful save.
 * Feed it from `useDebouncedSave`. `data-status` is `idle | saving | saved | error` for tests.
 */
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
