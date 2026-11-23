import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DateRangePicker, type DateRangeValue } from "@/src/components/DateRangePicker";
import { renderWithTrap, useTouchEnv } from "./touchEnv";

vi.mock("@/src/providers/ThemeContext", () => ({ useTheme: () => ({ isDark: false }) }));
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });

function Controlled({ initial = null, onChange }: { initial?: DateRangeValue; onChange: (v: DateRangeValue) => void }) {
    const [ value, setValue ] = useState<DateRangeValue>(initial);
    return <DateRangePicker value={value} onChange={(v) => { setValue(v); onChange(v); }} testId="range" />;
}

const dialog = () => screen.getByRole("dialog");

describe("DateRangePicker on a touch screen", () => {
    useTouchEnv({ now: "2026-03-31T15:00:00Z", providerZone: "Pacific/Kiritimati" });

    it("always shows Desde and Hasta, with no presets", () => {
        const { container } = renderWithTrap(<Controlled onChange={() => {}} />);
        expect(container.querySelector("input")).toBeNull();
        expect(screen.getByTestId("range-from")).toHaveTextContent("Selecciona fecha");
        expect(screen.getByTestId("range-to")).toHaveTextContent("Selecciona fecha");
        for (const name of [ "Hoy", "Esta semana", "Este mes", "Personalizado" ]) {
            expect(within(screen.getByTestId("range")).queryByRole("button", { name })).toBeNull();
        }
    });

    it("shows an applied range in both fields", () => {
        renderWithTrap(<Controlled initial={[ "2026-02-03", "2026-02-10" ]} onChange={() => {}} />);
        expect(screen.getByTestId("range-from")).toHaveTextContent("03/02/2026");
        expect(screen.getByTestId("range-to")).toHaveTextContent("10/02/2026");
    });

    it("emits only once both days are chosen, with Hasta on or after Desde", async () => {
        const onChange = vi.fn();
        renderWithTrap(<Controlled onChange={onChange} />);
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId("range-from"));
        expect(dialog()).toHaveAccessibleName("Desde");
        fireEvent.click(within(dialog()).getByRole("button", { name: / 10 de abril de 2026/ }));
        await waitFor(() => expect(screen.getByTestId("range-from")).toHaveTextContent("10/04/2026"));
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId("range-to"));
        expect(within(dialog()).getByRole("button", { name: / 9 de abril de 2026/ })).toBeDisabled();
        fireEvent.click(within(dialog()).getByRole("button", { name: / 12 de abril de 2026/ }));
        await waitFor(() => expect(onChange).toHaveBeenCalledWith([ "2026-04-10", "2026-04-12" ]));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("range-to")).toHaveTextContent("12/04/2026");
    });

    it("moving Desde past Hasta withdraws the applied range and asks for Hasta again", async () => {
        const onChange = vi.fn();
        renderWithTrap(<Controlled initial={[ "2026-02-03", "2026-02-10" ]} onChange={onChange} />);
        fireEvent.click(screen.getByTestId("range-from"));
        fireEvent.click(within(dialog()).getByRole("button", { name: "Mes siguiente" }));
        fireEvent.click(within(dialog()).getByRole("button", { name: / 20 de marzo de 2026/ }));
        await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("range-from")).toHaveTextContent("20/03/2026");
        expect(screen.getByTestId("range-to")).toHaveTextContent("Selecciona fecha");

        fireEvent.click(screen.getByTestId("range-to"));
        fireEvent.click(within(dialog()).getByRole("button", { name: / 25 de marzo de 2026/ }));
        await waitFor(() => expect(onChange).toHaveBeenLastCalledWith([ "2026-03-20", "2026-03-25" ]));
    });

    it("a lone Desde with nothing applied emits nothing", async () => {
        const onChange = vi.fn();
        renderWithTrap(<Controlled onChange={onChange} />);
        fireEvent.click(screen.getByTestId("range-from"));
        fireEvent.click(within(dialog()).getByRole("button", { name: / 10 de abril de 2026/ }));
        await waitFor(() => expect(screen.getByTestId("range-from")).toHaveTextContent("10/04/2026"));
        expect(onChange).not.toHaveBeenCalled();
    });

    it("clearing a day withdraws the applied range", () => {
        const onChange = vi.fn();
        renderWithTrap(<Controlled initial={[ "2026-02-03", "2026-02-10" ]} onChange={onChange} />);
        const clears = within(screen.getByTestId("range")).getAllByRole("button", { name: "Borrar" });
        fireEvent.click(clears[1]);
        expect(onChange).toHaveBeenCalledWith(null);
        expect(screen.getByTestId("range-from")).toHaveTextContent("03/02/2026");
        expect(screen.getByTestId("range-to")).toHaveTextContent("Selecciona fecha");
    });
});
