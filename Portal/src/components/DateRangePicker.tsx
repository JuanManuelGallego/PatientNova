import { ConfigProvider, DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/es";
import esEs from "antd/locale/es_ES";
import { getAntThemeConfig } from "@/src/config/antTheme";
import { useTheme } from "@/src/providers/ThemeContext";

dayjs.locale("es");
const mobilePopupStyle: React.CSSProperties = {
  maxWidth: "100vw",
};

export type DateRangeValue = [string, string] | null;

export function DateRangePicker({
  value,
  onChange,
  popupContainer,
  testId,
}: {
  value: DateRangeValue;
  onChange: (range: [string, string]) => void;
  popupContainer?: () => HTMLElement | null;
  testId?: string;
}) {
  const { isDark } = useTheme();
  const handleChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (!dates || !dates[0] || !dates[1]) return;
    onChange([dates[0].format("YYYY-MM-DD"), dates[1].format("YYYY-MM-DD")]);
  };

  return (
    <ConfigProvider locale={esEs} theme={getAntThemeConfig(isDark)}>
      <DatePicker.RangePicker
        value={value ? [dayjs(value[0]), dayjs(value[1])] : null}
        onChange={handleChange}
        format="DD/MM/YYYY"
        placeholder={["Desde", "Hasta"]}
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
