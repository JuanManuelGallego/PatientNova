import { LBL_SAVED, LBL_SAVE_ERROR } from "@/src/constants/ui";

export type SaveStatus = "idle" | "saved" | "error";

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  showPill?: boolean;
  showText?: boolean;
}

export function SaveStatusIndicator({
  status,
  showPill = true,
  showText = true,
}: SaveStatusIndicatorProps) {
  return (
    <>
      {showPill && (
        <div className="save-status-pill" data-status={status}>
          {status === "saved" && <>{LBL_SAVED}</>}
          {status === "error" && <>{LBL_SAVE_ERROR}</>}
        </div>
      )}
      {showText && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <span style={{ fontSize: 12, color: "var(--c-gray-400)", alignSelf: "center" }}>
          {status === "saved" && "Guardado"}
          {status === "error" && "Error al guardar"}
        </span>
        </div>
      )}
    </>
  );
}
