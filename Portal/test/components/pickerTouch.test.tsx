import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZonedDatePicker } from "@/src/components/ZonedDatePicker";
import { DateRangePicker } from "@/src/components/DateRangePicker";

vi.mock("@/src/providers/ThemeContext", () => ({ useTheme: () => ({ isDark: false }) }));

vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });

const original = window.matchMedia;
function setPointer(coarse: boolean) {
    window.matchMedia = ((query: string) => ({
        matches: coarse && query === "(pointer: coarse)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
    })) as unknown as typeof window.matchMedia;
}
afterEach(() => { window.matchMedia = original; });

describe("date picker", () => {
    it("is read-only on a coarse pointer", () => {
        setPointer(true);
        const { container } = render(<ZonedDatePicker data-testid="p" />);
        expect(container.querySelector("input")!.readOnly).toBe(true);
    });
});

describe.each([
    ["time picker", () => <ZonedDatePicker.TimePicker data-testid="p" />],
    ["range picker", () => <DateRangePicker value={null} onChange={() => {}} testId="p" />],
])("%s", (_name, ui) => {
    it("has no text input on a coarse pointer", () => {
        setPointer(true);
        const { container } = render(ui());
        expect(container.querySelector("input")).toBeNull();
        expect(container.querySelector(".ant-picker")).toBeNull();
    });
});

describe.each([
    ["date picker", () => <ZonedDatePicker data-testid="p" />],
    ["time picker", () => <ZonedDatePicker.TimePicker data-testid="p" />],
    ["range picker", () => <DateRangePicker value={null} onChange={() => {}} testId="p" />],
])("%s", (_name, ui) => {
    it("is antd's editable input otherwise", () => {
        setPointer(false);
        const { container } = render(ui());
        expect(container.querySelector("input")!.readOnly).toBe(false);
    });
});

it("lets callers override on a coarse pointer", () => {
    setPointer(true);
    const { container } = render(<ZonedDatePicker inputReadOnly={false} />);
    expect(container.querySelector("input")!.readOnly).toBe(false);
});
