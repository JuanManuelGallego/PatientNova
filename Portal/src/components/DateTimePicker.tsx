import { ConfigProvider } from "antd";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/es";
import esEs from "antd/locale/es_ES";

dayjs.locale("es");
import { getAntThemeConfig } from "@/src/config/antTheme";
import { useTheme } from "@/src/providers/ThemeContext";
import { calendarDayOf, calendarDayToIso, todayFormattedString } from "@/src/utils/TimeUtils";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { fromPickerValue, nowInZone, toPickerValue, useCoarsePointer, ZonedDatePicker } from "./ZonedDatePicker";
import { TouchPickerField } from "./Pickers/TouchPickerField";

// responsive: popup uses full viewport width on mobile to prevent clipping
const mobilePopupStyle: React.CSSProperties = {
  maxWidth: "100vw",
};

export function DateTimePicker({
  date,
  onChange,
  showTime = false,
  isFuture = false,
  mode = "instant",
  popupContainer,
  testId,
}: {
  date: string | undefined;
  onChange: (date: string) => void;
  showTime?: boolean;
  isFuture?: boolean;
  /**
   * - `instant` (default): a UTC ISO instant, picked as wall-clock time in the provider's timezone.
   * - `calendarDay`: a day stored as UTC midnight ("YYYY-MM-DDT00:00:00.000Z"), e.g. birth dates.
   * - `localDate`: a bare "YYYY-MM-DD" day, e.g. list filters.
   */
  mode?: "instant" | "calendarDay" | "localDate";
  popupContainer?: () => HTMLElement | null;
  testId?: string;
}) {
  const timezone = useDisplayTimezone();
  const { isDark } = useTheme();
  // Touch screens get a bottom sheet: antd's side-by-side calendar and time columns overflow a phone.
  const coarse = useCoarsePointer();
  const now = () => nowInZone(timezone);
  const toValue = (value: string): Dayjs | null => {
    if (mode === "instant") return toPickerValue(value, timezone);
    const day = calendarDayOf(value);
    return day ? dayjs.utc(`${day}T00:00:00`) : null;
  };
  const handleChange = (selectedDate: Dayjs | null) => {
    if (!selectedDate) return;
    const day = selectedDate.format("YYYY-MM-DD");
    onChange(
      mode === "calendarDay" ? calendarDayToIso(day)
        : mode === "localDate" ? day
          : fromPickerValue(selectedDate, timezone),
    );
  };

  const disabledDate = (current: Dayjs) =>
    isFuture
      ? current && current.isBefore(now(), "day")
      : current && current.isAfter(now(), "day");
  const disabledTime = isFuture
    ? (current: Dayjs | null) => {
        const nowInZone = now();
        if (!current || !current.isSame(nowInZone, "day")) return {};
        return {
          disabledHours: () =>
            Array.from({ length: nowInZone.hour() }, (_, i) => i),
          disabledMinutes: (hour: number) => {
            if (hour !== nowInZone.hour()) return [];
            const minutes = [];
            for (let i = 0; i < nowInZone.minute(); i += 5) minutes.push(i);
            return minutes;
          },
          disabledSeconds: () => [],
        };
      }
    : undefined;

  if (coarse) {
    const today = todayFormattedString(timezone);
    const year = Number(today.slice(0, 4));
    // A stored day outside the default window (a record older than 120 years) must still be selectable.
    const storedYear = date ? toValue(date)?.year() ?? year : year;
    const years = isFuture
      ? { from: Math.min(year, storedYear), to: Math.max(year + 10, storedYear) }
      : { from: Math.min(year - 120, storedYear), to: year };
    return (
      <TouchPickerField
        kind={showTime ? "dateTime" : "date"}
        value={date ? toValue(date) : null}
        onChange={handleChange}
        today={today}
        format={showTime ? "DD/MM/YYYY HH:mm" : "DD/MM/YYYY"}
        placeholder={showTime ? "Selecciona fecha y hora" : "Selecciona fecha"}
        title={showTime ? "Fecha y hora" : "Fecha"}
        disabledDate={disabledDate}
        disabledTime={disabledTime}
        minuteStep={5}
        minMonth={isFuture ? today.slice(0, 7) : undefined}
        maxMonth={isFuture ? undefined : today.slice(0, 7)}
        // Birth dates sit decades back: month-by-month arrows would take hundreds of taps.
        years={mode === "calendarDay" ? years : undefined}
        popupContainer={popupContainer}
        testId={testId}
      />
    );
  }

  return (
    <ConfigProvider locale={esEs} theme={getAntThemeConfig(isDark)}>
      <ZonedDatePicker
        className="form-picker"
        value={date ? toValue(date) : null}
        onChange={handleChange}
        showTime={
          showTime
            ? {
                format: "HH:mm",
                minuteStep: 5,
              }
            : false
        }
        needConfirm
        format={showTime ? "DD/MM/YYYY HH:mm" : "DD/MM/YYYY"}
        placeholder={showTime ? "Selecciona fecha y hora" : "Selecciona fecha"}
        disabledDate={disabledDate}
        disabledTime={disabledTime}
        style={{ width: "100%" }}
        styles={{ popup: { root: mobilePopupStyle } }}
        getPopupContainer={
          popupContainer ? () => popupContainer() ?? document.body : undefined
        }
        data-testid={testId}
      />
    </ConfigProvider>
  );
}
