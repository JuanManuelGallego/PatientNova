import { ConfigProvider, DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/es";
import esEs from "antd/locale/es_ES";

dayjs.locale("es");
import { getAntThemeConfig } from "@/src/config/antTheme";
import { useTheme } from "@/src/providers/ThemeContext";
import { browserTimezone, fmtTimezoneLabel, fromWallClock, getDisplayTimezone, toWallClock } from "@/src/utils/TimeUtils";

// responsive: popup uses full viewport width on mobile to prevent clipping
const mobilePopupStyle: React.CSSProperties = {
  maxWidth: "100vw",
};

export function DateTimePicker({
  date,
  onChange,
  showTime = false,
  isFuture = false,
  emitLocalDate = false,
  popupContainer,
  testId,
}: {
  date: string | undefined;
  onChange: (date: string) => void;
  showTime?: boolean;
  isFuture?: boolean;
  emitLocalDate?: boolean;
  popupContainer?: () => HTMLElement | null;
  testId?: string;
}) {
  const { isDark } = useTheme();
  // antd/dayjs only know the browser zone: the picker holds the provider's wall-clock time as a
  // browser-local dayjs, converted from/to UTC at the edges.
  const now = () => dayjs(toWallClock(new Date()));
  const handleChange = (selectedDate: Dayjs | null) => {
    if (!selectedDate) return;
    const selectedIso = emitLocalDate
      ? selectedDate.format("YYYY-MM-DD")
      : fromWallClock(selectedDate.format("YYYY-MM-DDTHH:mm:ss"));
    onChange(selectedIso);
  };
  const showZone = showTime && getDisplayTimezone() !== browserTimezone();

  return (
    <ConfigProvider locale={esEs} theme={getAntThemeConfig(isDark)}>
      <DatePicker
        value={date ? dayjs(toWallClock(date)) : null}
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
        renderExtraFooter={showZone ? () => <TimezoneFooter /> : undefined}
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
export function TimezoneFooter() {
  return (
    <span style={{ fontSize: 12, color: "var(--c-gray-500, #6b7280)" }}>
      Hora de {fmtTimezoneLabel()}
    </span>
  );
}
