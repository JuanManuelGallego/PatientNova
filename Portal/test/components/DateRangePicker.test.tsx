import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { DateRangePicker } from "@/src/components/DateRangePicker";

vi.mock("antd", () => ({
  ConfigProvider: ({ children }: { children: React.ReactNode }) => children,
  DatePicker: {
    RangePicker: ({ onChange }: { onChange: (dates: null) => void }) => (
      <button onClick={() => onChange(null)}>Clear range</button>
    ),
  },
}));
vi.mock("antd/locale/es_ES", () => ({ default: {} }));
vi.mock("@/src/config/antTheme", () => ({ getAntThemeConfig: () => ({}) }));
vi.mock("@/src/providers/ThemeContext", () => ({
  useTheme: () => ({ isDark: false }),
}));

it("emits null when the range is cleared", () => {
  const onChange = vi.fn();
  render(
    <DateRangePicker
      value={["2026-09-01", "2026-09-30"]}
      onChange={onChange}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Clear range" }));

  expect(onChange).toHaveBeenCalledWith(null);
});
