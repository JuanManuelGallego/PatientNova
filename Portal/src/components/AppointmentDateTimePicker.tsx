import { useMemo } from "react";
import { ConfigProvider, DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/es";
import esEs from "antd/locale/es_ES";

import { getAntThemeConfig } from "@/src/config/antTheme";
import { useTheme } from "@/src/providers/ThemeContext";
import { TimezoneFooter } from "@/src/components/DateTimePicker";
import { browserTimezone, fromWallClock, getDisplayTimezone, toWallClock } from "@/src/utils/TimeUtils";

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
  const { isDark } = useTheme();
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

  // antd/dayjs only know the browser zone: the picker holds the provider's wall-clock time (business
  // hours are wall-clock hours there) as a browser-local dayjs, converted from/to UTC at the edges.
  const now = () => dayjs(toWallClock(new Date()));
  const showZone = getDisplayTimezone() !== browserTimezone();

  const handleChange = (selectedDate: Dayjs | null) => {
    if (!selectedDate) return;

    const iso = fromWallClock(selectedDate.second(0).millisecond(0).format("YYYY-MM-DDTHH:mm:ss"));
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

  return (
    <ConfigProvider locale={esEs} theme={getAntThemeConfig(isDark)}>
      <DatePicker
        value={date ? dayjs(toWallClock(date)) : null}
        onChange={handleChange}
        showTime={{
          format: "HH:mm",
          minuteStep: 5,
        }}
        needConfirm
        showNow={false}
        format="DD/MM/YYYY HH:mm"
        placeholder="Selecciona fecha y hora"
        disabledDate={(current) => !!current && current.isBefore(now(), "day")}
        disabledTime={(currentDate) => {
          const nowInZone = now();
          const selected =
            currentDate && currentDate.isValid()
              ? currentDate
              : date
                ? dayjs(toWallClock(date))
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
            disabledMinutes: (hour) => {
              const minutes: number[] = [];

              // Closing hour: only the exact hour mark is bookable.
              if (hour === BUSINESS_LAST_HOUR) {
                for (let i = 5; i < 60; i += 5) minutes.push(i);
              }

              if (isToday && hour === nowInZone.hour()) {
                for (let i = 0; i < nowInZone.minute(); i += 5) minutes.push(i);
              }

              return minutes;
            },
            disabledSeconds: () => [],
          };
        }}
        renderExtraFooter={showZone ? () => <TimezoneFooter /> : undefined}
        style={{ width: "100%" }}
      />
    </ConfigProvider>
  );
}