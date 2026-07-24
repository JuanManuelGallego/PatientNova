import { APPT_STATUS_CFG } from "@/src/types/Appointment";

export function CalendarLegend() {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 16,
        padding: "10px 16px",
        borderTop: "1px solid var(--c-gray-100)",
      }}
    >
      {Object.values(APPT_STATUS_CFG).map((cfg) => (
        <div
          key={cfg.label}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <span style={{ color: cfg.dot, fontSize: 14, lineHeight: 1 }}>●</span>
          <span style={{ fontSize: 12, color: "var(--c-gray-600)" }}>
            {cfg.label}
          </span>
        </div>
      ))}
    </div>
  );
}
