import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import "dayjs/locale/es";

dayjs.extend(utc);
dayjs.locale("es");
import { calendarDayOf, calendarDayToIso, todayFormattedString } from "@/src/utils/TimeUtils";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { fromPickerValue, nowInZone, toPickerValue } from "@/src/utils/pickerValue";
import { PickerField } from "./Pickers/PickerField";

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
        };
      }
    : undefined;

  const today = todayFormattedString(timezone);
  const year = Number(today.slice(0, 4));
  const storedYear = date ? toValue(date)?.year() ?? year : year;
  const years = isFuture
    ? { from: Math.min(year, storedYear), to: Math.max(year + 10, storedYear) }
    : { from: Math.min(year - 120, storedYear), to: year };
  return (
    <PickerField
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
      years={mode === "calendarDay" ? years : undefined}
      popupContainer={popupContainer}
      testId={testId}
    />
  );
}
