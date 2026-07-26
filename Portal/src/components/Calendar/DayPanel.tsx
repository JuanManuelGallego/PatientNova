import { ACTION_ICONS } from "@/src/config/icons";
import { fmtDate, fmtTime } from "@/src/utils/TimeUtils";
import { DayPanelProps } from "./types";

export function DayPanel({
  selectedDay,
  appts,
  blockedTimes,
  onClose,
  onViewAppt,
  onDrillToDay,
  onCreateAt,
  onSelectBlockedTime,
  onCreateBlockedTime,
}: DayPanelProps) {
  return (
    <div className="cal-day-panel-overlay" onClick={onClose}>
      <div className="cal-day-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cal-day-panel__header">
          <span className="cal-day-panel__title">{fmtDate(selectedDay)}</span>
          <button className="btn-close" onClick={onClose}>
            <ACTION_ICONS.close size={16} />
          </button>
        </div>
        {appts.length === 0 && blockedTimes.length === 0 ? (
          <p className="cal-day-panel__empty">No hay citas ni horarios bloqueados para este día.</p>
        ) : (
          <>
            {appts.length > 0 && (
              <div className="cal-day-panel__appt-list">
                {appts.map((a) => (
                  <div
                    key={a.id}
                    className="cal-day-panel__appt-item"
                    onClick={() => {
                      onViewAppt(a);
                      onClose();
                    }}
                  >
                    <div
                      className="cal-day-panel__appt-dot"
                      style={{
                        background: a.appointmentLocation.color ?? "var(--c-gray-400)",
                      }}
                    />
                    <span className="cal-day-panel__appt-name">
                      {a.patient.name} {a.patient.lastName}
                    </span>
                    <span className="cal-day-panel__appt-time">
                      {fmtTime(a.startAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {blockedTimes.length > 0 && (
              <>
                <h3 className="cal-day-panel__section-title">Horarios Bloqueados</h3>
                <div className="cal-day-panel__blocked-list">
                  {blockedTimes.map((bt) => (
                    <div
                      key={bt.id}
                      className="cal-day-panel__blocked-item"
                      onClick={() => {
                        onSelectBlockedTime(bt);
                        onClose();
                      }}
                    >
                      <div className="cal-day-panel__blocked-dot" />
                      <span className="cal-day-panel__blocked-time">
                        {fmtTime(bt.startTimeUtc)} - {fmtTime(bt.endTimeUtc)}
                      </span>
                      <span className="cal-day-panel__blocked-desc">
                        {bt.description || "Bloqueado"}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn-secondary btn-secondary--sm"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() => {
              onDrillToDay(selectedDay);
              onClose();
            }}
          >
            Ver día
          </button>
          <button
            className="btn-secondary btn-secondary--sm"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() => {
              onCreateBlockedTime(selectedDay);
              onClose();
            }}
          >
            Bloquear Horario
          </button>
          <button
            className="btn-primary btn-hero"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() => {
              onCreateAt(selectedDay);
              onClose();
            }}
          >
            Nueva Cita
          </button>
        </div>
      </div>
    </div>
  );
}
