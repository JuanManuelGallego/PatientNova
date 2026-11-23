import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import "dayjs/locale/es";

dayjs.extend(utc);
dayjs.locale("es");
import { calendarDayOf, calendarDayToIso, todayFormattedString } from "@/src/utils/TimeUtils";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { nowInZone } from "@/src/utils/pickerValue";
import { PickerField } from "./Pickers/PickerField";

export function DateTimePicker({
  date,
  onChange,
  isFuture = false,
  mode,
  popupContainer,
  testId,
}: {
  date: string | undefined;
  onChange: (date: string) => void;
  isFuture?: boolean;
  /**
   * - `calendarDay`: a day stored as UTC midnight ("YYYY-MM-DDT00:00:00.000Z"), e.g. birth dates.
   * - `localDate`: a bare "YYYY-MM-DD" day, e.g. list filters.
   */
  mode: "calendarDay" | "localDate";
  popupContainer?: () => HTMLElement | null;
  testId?: string;
}) {
  const timezone = useDisplayTimezone();
  const now = () => nowInZone(timezone);
  const toValue = (value: string): Dayjs | null => {
    const day = calendarDayOf(value);
    return day ? dayjs.utc(`${day}T00:00:00`) : null;
  };
  const handleChange = (selectedDate: Dayjs | null) => {
    if (!selectedDate) return;
    const day = selectedDate.format("YYYY-MM-DD");
    onChange(mode === "calendarDay" ? calendarDayToIso(day) : day);
  };

  const disabledDate = (current: Dayjs) =>
    isFuture
      ? current && current.isBefore(now(), "day")
      : current && current.isAfter(now(), "day");

  const today = todayFormattedString(timezone);
  const year = Number(today.slice(0, 4));
  const storedYear = date ? toValue(date)?.year() ?? year : year;
  const years = isFuture
    ? { from: Math.min(year, storedYear), to: Math.max(year + 10, storedYear) }
    : { from: Math.min(year - 120, storedYear), to: year };
  return (
    <PickerField
      value={date ? toValue(date) : null}
      onChange={handleChange}
      today={today}
      format="DD/MM/YYYY"
      placeholder="Selecciona fecha"
      title="Fecha"
      disabledDate={disabledDate}
      minMonth={isFuture ? today.slice(0, 7) : undefined}
      maxMonth={isFuture ? undefined : today.slice(0, 7)}
      years={mode === "calendarDay" ? years : undefined}
      popupContainer={popupContainer}
      testId={testId}
    />
  );
}
