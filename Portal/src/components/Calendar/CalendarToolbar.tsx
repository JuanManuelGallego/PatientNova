import { calendarStyles } from "./styles";
import { CalendarToolbarProps, ViewMode } from "./types";

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
        data-testid="calendar-nav-prev-button"
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
        <button onClick={onToday} className="btn-secondary btn-secondary--sm" data-testid="calendar-today-button">
          Hoy
        </button>
        <div style={calendarStyles.viewToggle}>
          {Object.values(ViewMode).map((v) => (
            <button
              key={v}
              onClick={() => onChangeView(v)}
              style={{
                ...calendarStyles.viewToggleBtn,
                ...(viewMode === v ? calendarStyles.viewToggleBtnActive : calendarStyles.viewToggleBtnDisabled),
              }}
              data-testid={v === ViewMode.Month ? "calendar-view-month-button" : "calendar-view-week-button"}
              title={
                v === ViewMode.Month
                  ? "Vista mensual (M)"
                  : "Vista semanal (W)"
              }
            >
              {v === ViewMode.Month ? "Mes" : "Semana"}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={onNext}
        className="btn-secondary"
        style={{ padding: "7px 14px", fontSize: 16 }}
        data-testid="calendar-nav-next-button"
      >
        &#8250;
      </button>
    </div>
  );
}
