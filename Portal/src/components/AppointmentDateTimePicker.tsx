import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { toPickerValue } from "@/src/utils/pickerValue";
import { DateTimeField } from "@/src/components/Pickers/DateTimeField";
import { END_OF_DAY, toTimeValue, type TimeSpan } from "@/src/components/Pickers/timeRules";

const BUSINESS_OPEN = "06:00";
const BUSINESS_CLOSE = "20:00";

export interface BusyInterval {
  start: string;
  end: string;
}

interface AppointmentDateTimePickerProps {
  date: string | undefined;
  onChange: (date: string) => void;
  bookedSlots?: BusyInterval[];
  blockedSlots?: BusyInterval[];
  duration?: number;
  label?: React.ReactNode;
  testId?: string;
}

export function AppointmentDateTimePicker({
  date,
  onChange,
  bookedSlots = [],
  blockedSlots = [],
  duration = 60,
  label,
  testId = "appointment-start",
}: AppointmentDateTimePickerProps) {
  const timezone = useDisplayTimezone();

  const spanOn = (day: string, interval: BusyInterval, kind: "cita" | "bloqueo"): TimeSpan | null => {
    const start = toPickerValue(interval.start, timezone);
    const end = toPickerValue(interval.end, timezone);
    const startDay = start.format("YYYY-MM-DD");
    const endDay = end.format("YYYY-MM-DD");
    const endsAtMidnight = end.hour() === 0 && end.minute() === 0;
    if (startDay > day || endDay < day || (endDay === day && endsAtMidnight && startDay < day)) return null;
    const from = startDay < day ? 0 : start.hour() * 60 + start.minute();
    const to = endDay > day ? END_OF_DAY : end.hour() * 60 + end.minute();
    return {
      start: toTimeValue(from),
      end: toTimeValue(to),
      label: kind === "cita" ? "Ocupada" : "Bloqueada",
      detail: `Se cruza con ${kind === "cita" ? "una cita" : "un bloqueo"}`,
    };
  };

  const busyOn = (day: string): TimeSpan[] => [
    ...bookedSlots.map((i) => spanOn(day, i, "cita")),
    ...blockedSlots.map((i) => spanOn(day, i, "bloqueo")),
  ].filter((s): s is TimeSpan => s !== null);

  return (
    <DateTimeField
      label={label}
      ariaLabel="Fecha y hora"
      value={date}
      onChange={onChange}
      when="future"
      time={(day) => ({ min: BUSINESS_OPEN, max: BUSINESS_CLOSE, duration, unavailable: busyOn(day) })}
      testId={testId}
    />
  );
}
