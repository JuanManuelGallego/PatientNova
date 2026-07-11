import { ViewMode, CalendarToolbarProps } from "../types";
import { calendarStyles } from "../styles";

export function CalendarToolbar({
  navLabel,
  viewMode,
  onPrev,
  onNext,
  onToday,
  onChangeView,
}: CalendarToolbarProps) {
  return (
    <div className="cal-nav-header">
      <button
        onClick={onPrev}
        className="btn-secondary"
        style={{ padding: "7px 14px", fontSize: 16 }}
      >
        &#8249;
      </button>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span className="cal-month-label">{navLabel}</span>
        <button onClick={onToday} className="btn-secondary btn-secondary--sm">
          Hoy
        </button>
        <div style={calendarStyles.viewToggle}>
          {Object.values(ViewMode).map((v) => (
            <button
              key={v}
              onClick={() => onChangeView(v)}
              style={{
                ...calendarStyles.viewToggleBtn,
                ...(viewMode === v ? calendarStyles.viewToggleBtnActive : {}),
              }}
              title={
                v === ViewMode.Month
                  ? "Vista mensual (M)"
                  : v === ViewMode.Week
                    ? "Vista semanal (W)"
                    : "Vista diaria (D)"
              }
            >
              {v === ViewMode.Month ? "Mes" : v === ViewMode.Week ? "Semana" : "Día"}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={onNext}
        className="btn-secondary"
        style={{ padding: "7px 14px", fontSize: 16 }}
      >
        &#8250;
      </button>
    </div>
  );
}
