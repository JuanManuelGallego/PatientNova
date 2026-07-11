import { HOURS, TODAY_STR, toDateStr, apptHour, DAY_NAMES_ES } from "../constants";
import { calendarStyles } from "../styles";
import { ApptChip } from "./ApptChip";
import { WeekViewProps } from "../types";

export function WeekView({
  weekDays,
  apptByDate,
  holidayMap,
  loading,
  onDrillToDay,
  onViewAppt,
  onCreateAt,
}: WeekViewProps) {
  return (
    <div style={{ overflowX: "auto" }}>
      {loading ? (
        <div className="cal-loading">Cargando citas…</div>
      ) : (
        <div style={calendarStyles.weekGrid}>
          <div style={calendarStyles.weekGutter} />
          {weekDays.map((day, di) => {
            const ds = toDateStr(day);
            const isToday = ds === TODAY_STR;
            const holiday = holidayMap[ ds ];
            const dayAppts = apptByDate[ ds ] ?? [];
            return (
              <div
                key={di}
                style={{
                  ...calendarStyles.weekDayHeader,
                  background: isToday
                    ? "var(--c-primary-50, #eff6ff)"
                    : "var(--c-gray-50, #f9fafb)",
                  borderBottom: isToday
                    ? "2px solid var(--c-primary, #2563eb)"
                    : "2px solid var(--c-gray-200, #e5e7eb)",
                }}
              >
                <span style={calendarStyles.weekDayName}>
                  {DAY_NAMES_ES[ di ]}
                </span>
                <span
                  style={{
                    ...calendarStyles.weekDayNum,
                    ...(isToday ? calendarStyles.weekDayNumToday : {}),
                  }}
                  onClick={() => onDrillToDay(ds)}
                  title="Ver en vista día"
                >
                  {day.getDate()}
                </span>
                {holiday && (
                  <span title={holiday} style={{ fontSize: 11, opacity: 0.7 }}>
                    🇨🇴
                  </span>
                )}
                {dayAppts.length > 0 && (
                  <span style={calendarStyles.weekDayCount}>
                    {dayAppts.length}
                  </span>
                )}
              </div>
            );
          })}
          {HOURS.map((hour) => (
            <>
              <div key={`lbl-${hour}`} style={calendarStyles.weekTimeLabel}>
                {String(hour).padStart(2, "0")}:00
              </div>
              {weekDays.map((day, di) => {
                const ds = toDateStr(day);
                const slotAppts = (apptByDate[ ds ] ?? []).filter(
                  (a) => apptHour(a) === hour,
                );
                const isToday = ds === TODAY_STR;
                return (
                  <div
                    key={`slot-${hour}-${di}`}
                    style={{
                      ...calendarStyles.weekSlot,
                      background: isToday
                        ? "var(--c-primary-50, #eff6ff)"
                        : "var(--c-surface, #fff)",
                    }}
                    onClick={() => onCreateAt(ds)}
                    title={`Nueva cita ${String(hour).padStart(2, "0")}:00`}
                  >
                    {slotAppts.map((a) => (
                      <ApptChip key={a.id} a={a} compact onViewAppt={onViewAppt} />
                    ))}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      )}
    </div>
  );
}
