import { fmtTime } from "@/src/utils/TimeUtils";
import { BlockedTimeChipProps } from "./types";

export function BlockedTimeChip({ bt, onSelectBlockedTime, style }: BlockedTimeChipProps) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelectBlockedTime(bt); }}
      style={{
        background: "var(--c-gray-100)",
        color: "var(--c-gray-600)",
        width: "100%",
        marginBottom: 2,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 4,
        ...style,
      }}
      title={bt.description || "Horario bloqueado"}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 2,
          background: "var(--c-gray-400)",
          flexShrink: 0,
        }}
        title="Horario bloqueado"
      />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
        {fmtTime(bt.startTimeUtc)} {bt.description || "Bloqueado"}
      </span>
    </div>
  );
}
