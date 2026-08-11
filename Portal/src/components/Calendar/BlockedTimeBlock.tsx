import { fmtTime } from "@/src/utils/TimeUtils";
import { BlockedTimeBlockProps } from "./types";

export function BlockedTimeBlock({ bt, onSelectBlockedTime, style }: BlockedTimeBlockProps) {
  return (
    <div
      data-testid={`calendar-blocked-${bt.id}`}
      onClick={(e) => { e.stopPropagation(); onSelectBlockedTime(bt); }}
      style={{
        position: "absolute",
        background: "var(--c-gray-100)",
        borderLeft: "3px solid var(--c-gray-400)",
        cursor: "pointer",
        zIndex: 0,
        borderRadius: "0 4px 4px 0",
        display: "flex",
        alignItems: "center",
        ...style,
      }}
      title={bt.description || "Horario bloqueado"}
    >
      <span style={{ fontSize: 10, color: "var(--c-gray-600)", padding: "2px 4px", fontWeight: 500 }}>
        {fmtTime(bt.startTimeUtc)}
        {bt.description ? ` ${bt.description}` : " Bloqueado"}
      </span>
    </div>
  );
}
