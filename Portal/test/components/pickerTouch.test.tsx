import { render, screen } from "@testing-library/react";
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

describe.each([
    ["date picker", () => <ZonedDatePicker data-testid="p" />, () => screen.getByTestId("p")],
    ["time picker", () => <ZonedDatePicker.TimePicker data-testid="p" />, () => screen.getByTestId("p")],
    ["range picker", () => <DateRangePicker value={null} onChange={() => {}} testId="p" />, () => screen.getByTestId("p").querySelector("input")!],
])("%s", (_name, ui, getInput) => {
    it("is read-only on a coarse pointer", () => {
        setPointer(true);
        const { container } = render(ui());
        const input = container.querySelector("input")!;
        expect(input.readOnly).toBe(true);
        void getInput;
    });
    it("is editable otherwise", () => {
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
