import { useMemo } from "react";
import { ConfigProvider, DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/es";
import esEs from "antd/locale/es_ES";

import { getAntThemeConfig } from "@/src/config/antTheme";
import { useTheme } from "@/src/providers/ThemeContext";

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

interface AppointmentDateTimePickerProps {
  date: string | undefined;
  onChanged: (date: string) => void;
  onError: (error: string) => void;
  bookedSlots?: string[];
}

export function AppointmentDateTimePicker({
  date,
  onChanged,
  onError,
  bookedSlots = [],
}: AppointmentDateTimePickerProps) {
  const { isDark } = useTheme();
  const bookedSet = useMemo(
    () =>
      new Set(
        bookedSlots.map((s) => dayjs(s).second(0).millisecond(0).valueOf())
      ),
    [bookedSlots]
  );

  const handleChange = (selectedDate: Dayjs | null) => {
    if (!selectedDate) return;

    const normalized = selectedDate.second(0).millisecond(0);

    if (bookedSet.has(normalized.valueOf())) {
      onError("Este horario ya está reservado");
      return;
    }

    onChanged(normalized.toISOString());
  };

  return (
    <ConfigProvider locale={esEs} theme={getAntThemeConfig(isDark)}>
      <DatePicker
        value={date ? dayjs(date) : null}
        onChange={handleChange}
        showTime={{
          format: "HH:mm",
          minuteStep: 5,
        }}
        needConfirm
        showNow={false}
        format="DD/MM/YYYY HH:mm"
        placeholder="Selecciona fecha y hora"
        disabledDate={(current) => !!current && current.isBefore(dayjs(), "day")}
        disabledTime={(currentDate) => {
          const now = dayjs();
          const selected =
            currentDate && currentDate.isValid()
              ? currentDate
              : date
                ? dayjs(date)
                : null;
          const isToday = !!selected && selected.isSame(now, "day");

          return {
            disabledHours: () => {
              const hours = [...OUT_OF_HOURS];
              if (isToday) {
                for (let i = 0; i < now.hour(); i++) hours.push(i);
              }
              return hours;
            },
            disabledMinutes: (hour) => {
              const minutes: number[] = [];

              // Closing hour: only the exact hour mark is bookable.
              if (hour === BUSINESS_LAST_HOUR) {
                for (let i = 5; i < 60; i += 5) minutes.push(i);
              }

              if (isToday && hour === now.hour()) {
                for (let i = 0; i < now.minute(); i += 5) minutes.push(i);
              }

              return minutes;
            },
            disabledSeconds: () => [],
          };
        }}
        style={{ width: "100%" }}
      />
    </ConfigProvider>
  );
}