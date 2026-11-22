import { useMemo } from "react";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/es";

import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { fromPickerValue, nowInZone, toPickerValue } from "@/src/utils/pickerValue";
import { PickerField } from "@/src/components/Pickers/PickerField";
import { todayFormattedString } from "@/src/utils/TimeUtils";

dayjs.locale("es");

const BUSINESS_OPEN_HOUR = 6;
const BUSINESS_LAST_HOUR = 20;

const OUT_OF_HOURS: number[] = [
  ...Array.from({ length: BUSINESS_OPEN_HOUR }, (_, i) => i),
  ...Array.from(
    { length: 24 - (BUSINESS_LAST_HOUR + 1) },
    (_, i) => BUSINESS_LAST_HOUR + 1 + i
  ),
];

const BUSINESS_HOURS: number[] = Array.from(
  { length: BUSINESS_LAST_HOUR - BUSINESS_OPEN_HOUR + 1 },
  (_, i) => BUSINESS_OPEN_HOUR + i
);

interface BlockedSlot {
  start: string;
  end: string;
}

interface AppointmentDateTimePickerProps {
  date: string | undefined;
  onChange: (date: string) => void;
  onError: (error: string) => void;
  bookedSlots?: string[];
  blockedSlots?: BlockedSlot[];
}

export function AppointmentDateTimePicker({
  date,
  onChange,
  onError,
  bookedSlots = [],
  blockedSlots = [],
}: AppointmentDateTimePickerProps) {
  const timezone = useDisplayTimezone();
  const bookedSet = useMemo(
    () =>
      new Set(
        bookedSlots.map((s) => dayjs(s).second(0).millisecond(0).valueOf())
      ),
    [bookedSlots]
  );

  const blockedRanges = useMemo(
    () =>
      blockedSlots.map((s) => ({
        start: dayjs(s.start).valueOf(),
        end: dayjs(s.end).valueOf(),
      })),
    [blockedSlots]
  );

  // Business hours are wall-clock hours in the provider's timezone (see utils/pickerValue).
  const now = () => nowInZone(timezone);

  const handleChange = (selectedDate: Dayjs | null) => {
    if (!selectedDate) return;

    const iso = fromPickerValue(selectedDate.second(0).millisecond(0), timezone);
    const ts = new Date(iso).getTime();

    if (bookedSet.has(ts)) {
      onError("Este horario ya está reservado");
      return;
    }

    const apptEnd = ts + 60 * 60 * 1000;
    for (const range of blockedRanges) {
      if (ts < range.end && apptEnd > range.start) {
        onError("Este horario está bloqueado");
        return;
      }
    }

    onChange(iso);
  };

  const disabledDate = (current: Dayjs) => !!current && current.isBefore(now(), "day");
  const disabledTime = (currentDate: Dayjs | null) => {
    const nowInZone = now();
    const selected =
      currentDate && currentDate.isValid()
        ? currentDate
        : date
          ? toPickerValue(date, timezone)
          : null;
    const isToday = !!selected && selected.isSame(nowInZone, "day");

    return {
      disabledHours: () => {
        const hours = [...OUT_OF_HOURS];
        if (isToday) {
          for (let i = 0; i < nowInZone.hour(); i++) hours.push(i);
        }
        return hours;
      },
      disabledMinutes: (hour: number) => {
        const minutes: number[] = [];

        if (hour === BUSINESS_LAST_HOUR) {
          for (let i = 5; i < 60; i += 5) minutes.push(i);
        }

        if (isToday && hour === nowInZone.hour()) {
          for (let i = 0; i < nowInZone.minute(); i += 5) minutes.push(i);
        }

        return minutes;
      },
    };
  };

  const today = todayFormattedString(timezone);
  return (
    <PickerField
      kind="dateTime"
      value={date ? toPickerValue(date, timezone) : null}
      onChange={handleChange}
      today={today}
      format="DD/MM/YYYY HH:mm"
      placeholder="Selecciona fecha y hora"
      title="Fecha y hora"
      disabledDate={disabledDate}
      disabledTime={disabledTime}
      minuteStep={5}
      hours={BUSINESS_HOURS}
      minMonth={today.slice(0, 7)}
    />
  );
}
