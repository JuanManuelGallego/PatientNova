import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { TimeField, type TimeFieldProps } from "@/src/components/Pickers/TimeField";
import { TimeFormatProvider } from "@/src/components/Pickers/TimeFormat";
import { renderWithTrap, useTouchEnv } from "./touchEnv";

vi.mock("@/src/providers/ThemeContext", () => ({ useTheme: () => ({ isDark: false }) }));

function Harness({ initial = null, onChange, ...props }: Partial<TimeFieldProps> & { initial?: string | null }) {
    const [ value, setValue ] = useState<string | null>(initial);
    return (
        <TimeField
            ariaLabel="Hora"
            testId="time"
            {...props}
            value={value}
            onChange={(next) => { setValue(next); onChange?.(next); }}
        />
    );
}

const box = () => screen.getByRole("combobox", { name: "Hora" }) as HTMLInputElement;
const list = () => screen.getByRole("listbox");
const option = (name: string) => within(list()).getByRole("option", { name });
const optionNames = () => within(list()).getAllByRole("option").map((o) => o.getAttribute("aria-label"));
const typeIn = (text: string, how: "enter" | "blur" = "enter") => {
    fireEvent.change(box(), { target: { value: text } });
    if (how === "enter") fireEvent.keyDown(box(), { key: "Enter" });
    else fireEvent.blur(box());
};

describe("TimeField with a mouse", () => {
    it("shows the value in the box and opens the list of times on click", () => {
        render(<Harness initial="09:30" min="08:00" max="09:30" />);
        expect(box().value).toBe("09:30");
        expect(box()).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(box());
        expect(box()).toHaveAttribute("aria-expanded", "true");
        expect(optionNames()).toEqual([ "08:00", "08:15", "08:30", "08:45", "09:00", "09:15", "09:30" ]);
        expect(option("09:30")).toHaveAttribute("aria-selected", "true");
        expect(option("09:00")).toHaveAttribute("aria-selected", "false");
    });

    it("sets a time from the list and closes it", () => {
        const onChange = vi.fn();
        render(<Harness initial="09:30" onChange={onChange} />);
        fireEvent.click(box());
        fireEvent.click(option("10:15"));
        expect(onChange).toHaveBeenCalledWith("10:15");
        expect(screen.queryByRole("listbox")).toBeNull();
        expect(box().value).toBe("10:15");
    });

    it("does not emit when the chosen time is the current one", () => {
        const onChange = vi.fn();
        render(<Harness initial="09:30" onChange={onChange} />);
        fireEvent.click(box());
        fireEvent.click(option("09:30"));
        typeIn("9:30");
        expect(onChange).not.toHaveBeenCalled();
    });

    it("takes a typed time between the rows on Enter", () => {
        const onChange = vi.fn();
        render(<Harness initial="09:30" onChange={onChange} />);
        typeIn("935");
        expect(onChange).toHaveBeenCalledWith("09:35");
        expect(box().value).toBe("09:35");
        expect(screen.queryByRole("listbox")).toBeNull();
        typeIn("4:05 pm", "blur");
        expect(onChange).toHaveBeenLastCalledWith("16:05");
    });

    it("explains a typed time outside the rules, keeps it on Enter and reverts it on blur", () => {
        const onChange = vi.fn();
        render(<Harness initial="09:30" min="06:00" max="20:00" onChange={onChange} />);
        typeIn("21:00");
        expect(box()).toHaveAttribute("aria-invalid", "true");
        expect(box()).toHaveAccessibleDescription("Escribe una hora entre 06:00 y 20:00, en pasos de 5 min");
        expect(box().value).toBe("21:00");
        fireEvent.blur(box());
        expect(onChange).not.toHaveBeenCalled();
        expect(box().value).toBe("09:30");
        expect(box()).not.toHaveAttribute("aria-invalid");
    });

    it("greys out unavailable rows, never picks them, and explains a typed overlap", () => {
        const onChange = vi.fn();
        render(
            <Harness initial="09:00" min="09:00" max="10:30" duration={60} onChange={onChange}
                unavailable={[ { start: "10:00", end: "11:00", label: "Ocupada", detail: "Se cruza con la cita de 10:00 a 11:00" } ]} />,
        );
        fireEvent.click(box());
        expect(option("09:15, ocupada")).toHaveAttribute("aria-disabled", "true");
        expect(option("09:00")).not.toHaveAttribute("aria-disabled");
        fireEvent.click(option("09:15, ocupada"));
        expect(onChange).not.toHaveBeenCalled();
        typeIn("9:30");
        expect(onChange).not.toHaveBeenCalled();
        expect(box()).toHaveAccessibleDescription("Se cruza con la cita de 10:00 a 11:00");
    });

    it("moves through the list with the arrow keys, skipping unavailable rows, and picks on Enter", () => {
        const onChange = vi.fn();
        render(
            <Harness initial="09:00" min="09:00" max="10:00" onChange={onChange}
                unavailable={[ { start: "09:15", end: "09:30", label: "Ocupada" } ]} />,
        );
        fireEvent.keyDown(box(), { key: "ArrowDown" });
        expect(box()).toHaveAttribute("aria-expanded", "true");
        expect(box()).toHaveAttribute("aria-activedescendant", option("09:00").id);
        fireEvent.keyDown(box(), { key: "ArrowDown" });
        expect(box()).toHaveAttribute("aria-activedescendant", option("09:30").id);
        fireEvent.keyDown(box(), { key: "Enter" });
        expect(onChange).toHaveBeenCalledWith("09:30");
    });

    it("closes on Escape without emitting and without letting the key reach the dialog", () => {
        const onChange = vi.fn();
        const onDialogKey = vi.fn();
        render(<div onKeyDown={onDialogKey}><Harness initial="09:00" onChange={onChange} /></div>);
        fireEvent.click(box());
        fireEvent.keyDown(box(), { key: "Escape" });
        expect(screen.queryByRole("listbox")).toBeNull();
        expect(onDialogKey).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
    });

    it("lists an end field from its start with durations, and says how long it lasts", () => {
        render(<Harness initial="10:30" from="09:00" max="10:30" hint="duration" />);
        expect(box()).toHaveAccessibleDescription("1 h 30 min");
        fireEvent.click(box());
        expect(optionNames()).toEqual([ "09:15, 15 min", "09:30, 30 min", "09:45, 45 min", "10:00, 1 h", "10:15, 1 h 15 min", "10:30, 1 h 30 min" ]);
    });

    it("refuses an end at or before its start", () => {
        const onChange = vi.fn();
        render(<Harness initial="10:00" from="09:00" onChange={onChange} />);
        typeIn("9:00");
        expect(onChange).not.toHaveBeenCalled();
        expect(box()).toHaveAttribute("aria-invalid", "true");
    });

    it("says when the time ends with hint end", () => {
        render(<Harness initial="09:30" duration={50} hint="end" />);
        expect(box()).toHaveAccessibleDescription("Termina 10:20");
    });

    it("offers the end of the day where allowed", () => {
        const onChange = vi.fn();
        render(<Harness initial="23:00" from="22:30" endOfDay onChange={onChange} />);
        fireEvent.click(box());
        expect(optionNames().at(-1)).toBe("24:00, fin del día");
        fireEvent.click(option("24:00, fin del día"));
        expect(onChange).toHaveBeenCalledWith("24:00");
    });

    it("clears with empty text only when allowed", () => {
        const onChange = vi.fn();
        const { unmount } = render(<Harness initial="09:00" allowClear onChange={onChange} />);
        typeIn("", "blur");
        expect(onChange).toHaveBeenCalledWith(null);
        unmount();
        const other = vi.fn();
        render(<Harness initial="09:00" onChange={other} />);
        typeIn("", "blur");
        expect(other).not.toHaveBeenCalled();
        expect(box().value).toBe("09:00");
    });

    it("shows and lists 12-hour times from the format prop, still emitting HH:mm", () => {
        const onChange = vi.fn();
        render(<Harness initial="21:30" min="21:00" max="22:00" format="12h" onChange={onChange} />);
        expect(box().value).toBe("9:30 p. m.");
        fireEvent.click(box());
        expect(optionNames()).toEqual([ "9:00 p. m.", "9:15 p. m.", "9:30 p. m.", "9:45 p. m.", "10:00 p. m." ]);
        fireEvent.click(option("9:45 p. m."));
        expect(onChange).toHaveBeenCalledWith("21:45");
    });

    it("takes the format from TimeFormatProvider when the prop is absent", () => {
        render(<TimeFormatProvider format="12h"><Harness initial="09:30" /></TimeFormatProvider>);
        expect(box().value).toBe("9:30 a. m.");
    });

    it("passes the test id, invalid and disabled to the box", () => {
        render(<Harness initial="09:30" invalid disabled />);
        expect(screen.getByTestId("time")).toBe(box());
        expect(box()).toHaveAttribute("aria-invalid", "true");
        expect(box()).toBeDisabled();
    });
});

describe("TimeField on a touch screen", () => {
    useTouchEnv({ now: "2026-03-01T15:00:00Z", providerZone: "America/Bogota" });

    const sheet = () => screen.getByRole("dialog");

    it("shows a button that opens a sheet of times", () => {
        renderWithTrap(<Harness initial="09:30" title="Hora de inicio" />);
        const trigger = screen.getByTestId("time");
        expect(trigger.tagName).toBe("BUTTON");
        expect(trigger).toHaveTextContent("09:30");
        fireEvent.click(trigger);
        expect(sheet()).toHaveAccessibleName("Hora de inicio");
        expect(within(sheet()).getByRole("option", { name: "09:30" })).toHaveAttribute("aria-selected", "true");
    });

    it("sets the tapped time once the sheet has closed", async () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness initial="09:30" onChange={onChange} />);
        fireEvent.click(screen.getByTestId("time"));
        fireEvent.click(within(sheet()).getByRole("option", { name: "11:45" }));
        expect(screen.queryByRole("dialog")).toBeNull();
        await waitFor(() => expect(onChange).toHaveBeenCalledWith("11:45"));
        expect(screen.getByTestId("time")).toHaveTextContent("11:45");
    });

    it("takes a typed time from the box at the top of the sheet", async () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness initial="09:30" min="08:00" max="12:00" onChange={onChange} />);
        fireEvent.click(screen.getByTestId("time"));
        const typed = within(sheet()).getByRole("textbox", { name: "Escribir la hora" });
        fireEvent.change(typed, { target: { value: "13:00" } });
        fireEvent.keyDown(typed, { key: "Enter" });
        expect(typed).toHaveAttribute("aria-invalid", "true");
        expect(typed).toHaveAccessibleDescription("Escribe una hora entre 08:00 y 12:00, en pasos de 5 min");
        fireEvent.change(typed, { target: { value: "9:35" } });
        fireEvent.keyDown(typed, { key: "Enter" });
        expect(screen.queryByRole("dialog")).toBeNull();
        await waitFor(() => expect(onChange).toHaveBeenCalledWith("09:35"));
    });

    it("does not pick an unavailable row", async () => {
        const onChange = vi.fn();
        renderWithTrap(<Harness initial="09:00" unavailable={[ { start: "10:00", end: "11:00", label: "Ocupada" } ]} onChange={onChange} />);
        fireEvent.click(screen.getByTestId("time"));
        fireEvent.click(within(sheet()).getByRole("option", { name: "10:00, ocupada" }));
        expect(sheet()).toBeInTheDocument();
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(onChange).not.toHaveBeenCalled();
    });
});
