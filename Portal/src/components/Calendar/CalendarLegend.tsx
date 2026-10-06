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
      {Object.values([APPT_STATUS_CFG.CONFIRMED, APPT_STATUS_CFG.SCHEDULED, APPT_STATUS_CFG.COMPLETED]).map((cfg) => (
        <span
          key={cfg.label}
          style={{ background: cfg.bg, color: cfg.color, padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}
        >
          {cfg.label}
        </span>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            display: "inline-block",
            width: 14,
            height: 14,
            background: "var(--c-gray-100)",
            border: "1px solid var(--c-gray-300)",
            borderRadius: 2,
          }}
        />
        <span style={{ fontSize: 12, color: "var(--c-gray-600)" }}>
          Horario Bloqueado
        </span>
      </div>
    </div>
  );
}
