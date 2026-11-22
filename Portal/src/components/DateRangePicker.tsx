import "dayjs/locale/es";
import dayjs from "dayjs";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { todayFormattedString } from "@/src/utils/TimeUtils";
import { DateRangeField } from "./Pickers/DateRangeField";

dayjs.locale("es");

export type DateRangeValue = [string, string] | null;

export function DateRangePicker({
  value,
  onChange,
  popupContainer,
  testId,
}: {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  popupContainer?: () => HTMLElement | null;
  testId?: string;
}) {
  const timezone = useDisplayTimezone();
  return (
    <DateRangeField
      value={value}
      onChange={onChange}
      today={todayFormattedString(timezone)}
      popupContainer={popupContainer}
      testId={testId}
    />
  );
}
