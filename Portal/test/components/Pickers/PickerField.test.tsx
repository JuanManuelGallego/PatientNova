import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import { describe, expect, it, vi } from "vitest";
import { PickerField, type PickerFieldProps } from "@/src/components/Pickers/PickerField";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";

dayjs.extend(utc);

const TODAY = "2026-11-22";

function Harness({ initial = null, onChange, ...props }: Partial<PickerFieldProps> & { initial?: Dayjs | null }) {
    const [ value, setValue ] = useState<Dayjs | null>(initial);
    return (
        <FocusTrapProvider dismissOnBack>
            <PickerField
                kind="date"
                today={TODAY}
                format="DD/MM/YYYY"
                title="Fecha"
                testId="field"
                {...props}
                value={value}
                onChange={(next) => { setValue(next); onChange?.(next); }}
            />
        </FocusTrapProvider>
    );
}

const input = () => screen.getByTestId("field") as HTMLInputElement;
const type = (text: string, how: "blur" | "enter" = "blur") => {
    fireEvent.change(input(), { target: { value: text } });
    if (how === "blur") fireEvent.blur(input());
    else fireEvent.keyDown(input(), { key: "Enter" });
};
const wall = (d: Dayjs | null) => d?.format("YYYY-MM-DD HH:mm");

describe("PickerField with a mouse: typed date", () => {
    it("renders a text input with the formatted value and an icon that opens the calendar", () => {
        render(<Harness initial={dayjs.utc("2026-03-15T00:00:00")} />);
        expect(input().tagName).toBe("INPUT");
        expect(input().value).toBe("15/03/2026");
        fireEvent.click(screen.getByRole("button", { name: "Abrir calendario" }));
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("commits a valid date on blur and on Enter", () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        type("15/03/1990");
        expect(wall(onChange.mock.calls[0][0])).toBe("1990-03-15 00:00");
        type("01/02/2026", "enter");
        expect(wall(onChange.mock.calls[1][0])).toBe("2026-02-01 00:00");
        expect(input().value).toBe("01/02/2026");
    });

    it("accepts single-digit days and months", () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        type("5/3/2026");
        expect(wall(onChange.mock.calls[0][0])).toBe("2026-03-05 00:00");
        expect(input().value).toBe("05/03/2026");
    });

    it("reverts text that is not a date, without emitting", () => {
        const onChange = vi.fn();
        render(<Harness initial={dayjs.utc("2026-03-15T00:00:00")} onChange={onChange} />);
        fireEvent.change(input(), { target: { value: "31/02/2026" } });
        expect(input()).toHaveAttribute("aria-invalid", "true");
        fireEvent.blur(input());
        expect(onChange).not.toHaveBeenCalled();
        expect(input().value).toBe("15/03/2026");
        expect(input()).not.toHaveAttribute("aria-invalid");
    });

    it("rejects a disabled day", () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} disabledDate={(d) => d.format("YYYY-MM-DD") > TODAY} />);
        type("23/11/2026");
        expect(onChange).not.toHaveBeenCalled();
        expect(input().value).toBe("");
        type("22/11/2026");
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("Escape drops the edit", () => {
        const onChange = vi.fn();
        render(<Harness initial={dayjs.utc("2026-03-15T00:00:00")} onChange={onChange} />);
        fireEvent.change(input(), { target: { value: "01/01/2026" } });
        fireEvent.keyDown(input(), { key: "Escape" });
        expect(input().value).toBe("15/03/2026");
        fireEvent.blur(input());
        expect(onChange).not.toHaveBeenCalled();
    });

    it("does not re-emit an unchanged value", () => {
        const onChange = vi.fn();
        render(<Harness initial={dayjs.utc("2026-03-15T00:00:00")} onChange={onChange} />);
        type("15/03/2026");
        expect(onChange).not.toHaveBeenCalled();
    });

    it("clears with empty text only when allowed", () => {
        const onChange = vi.fn();
        const { unmount } = render(<Harness initial={dayjs.utc("2026-03-15T00:00:00")} allowClear onChange={onChange} />);
        type("");
        expect(onChange).toHaveBeenCalledWith(null);
        unmount();

        const other = vi.fn();
        render(<Harness initial={dayjs.utc("2026-03-15T00:00:00")} onChange={other} />);
        type("");
        expect(other).not.toHaveBeenCalled();
        expect(input().value).toBe("15/03/2026");
    });

    it("picks a day from the dialog and focuses the day that holds the tab stop", async () => {
        const onChange = vi.fn();
        render(<Harness initial={dayjs.utc("2026-11-10T00:00:00")} onChange={onChange} />);
        fireEvent.click(screen.getByRole("button", { name: "Abrir calendario" }));
        const dialog = screen.getByRole("dialog");
        expect(document.activeElement).toHaveAccessibleName(/martes, 10 de noviembre/);
        fireEvent.click(within(dialog).getByRole("button", { name: /jueves, 12 de noviembre/ }));
        await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
        expect(wall(onChange.mock.calls[0][0])).toBe("2026-11-12 00:00");
    });
});

describe("PickerField with a mouse: typed time", () => {
    const dateTime = { kind: "dateTime", format: "DD/MM/YYYY HH:mm", minuteStep: 5, title: "Fecha y hora" } as const;

    it("commits a date and time on the minute step", () => {
        const onChange = vi.fn();
        render(<Harness {...dateTime} onChange={onChange} />);
        type("15/12/2026 9:30");
        expect(wall(onChange.mock.calls[0][0])).toBe("2026-12-15 09:30");
    });

    it("rejects a minute off the step", () => {
        const onChange = vi.fn();
        render(<Harness {...dateTime} onChange={onChange} />);
        type("15/12/2026 09:32");
        expect(onChange).not.toHaveBeenCalled();
    });

    it("rejects hours outside the allowed list and disabled minutes", () => {
        const onChange = vi.fn();
        render(
            <Harness
                {...dateTime}
                hours={[ 8, 9, 10 ]}
                disabledTime={() => ({ disabledMinutes: (h) => (h === 9 ? [ 45 ] : []) })}
                onChange={onChange}
            />,
        );
        type("15/12/2026 14:00");
        type("15/12/2026 09:45");
        expect(onChange).not.toHaveBeenCalled();
        type("15/12/2026 09:40");
        expect(wall(onChange.mock.calls[0][0])).toBe("2026-12-15 09:40");
    });

    it("types a time of day for kind time and keeps the base day", () => {
        const onChange = vi.fn();
        render(
            <Harness kind="time" format="HH:mm" minuteStep={5} initial={dayjs.utc("2000-01-01T09:00:00")} onChange={onChange} title="Hora" />,
        );
        expect(input().value).toBe("09:00");
        type("17:05");
        expect(wall(onChange.mock.calls[0][0])).toBe("2000-01-01 17:05");
        expect(screen.getByRole("button", { name: "Abrir selector de hora" })).toBeInTheDocument();
    });
});
