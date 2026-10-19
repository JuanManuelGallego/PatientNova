import { ConfigProvider } from "antd";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/es";
import esEs from "antd/locale/es_ES";

dayjs.locale("es");
import { getAntThemeConfig } from "@/src/config/antTheme";
import { useTheme } from "@/src/providers/ThemeContext";
import { browserTimezone, calendarDayOf, calendarDayToIso, fmtTimezoneLabel } from "@/src/utils/TimeUtils";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { fromPickerValue, nowInZone, toPickerValue, ZonedDatePicker } from "./ZonedDatePicker";

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
  const showZone = showTime && mode === "instant" && timezone !== browserTimezone();

  return (
    <ConfigProvider locale={esEs} theme={getAntThemeConfig(isDark)}>
      <ZonedDatePicker
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
        disabledDate={(current) =>
          isFuture
            ? current && current.isBefore(now(), "day")
            : current && current.isAfter(now(), "day")
        }
        disabledTime={
          isFuture
            ? (current) => {
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
            : undefined
        }
        renderExtraFooter={showZone ? () => <TimezoneFooter timezone={timezone} /> : undefined}
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

/** Shown in pickers only when the device's timezone differs from the provider's. */
export function TimezoneFooter({ timezone }: { timezone: string }) {
  return (
    <span style={{ fontSize: 12, color: "var(--c-gray-500, #6b7280)" }}>
      Hora de {fmtTimezoneLabel(timezone)}
    </span>
  );
}
