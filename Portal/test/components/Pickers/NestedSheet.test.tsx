import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sheet } from "@/src/components/Sheet/Sheet";
import { DateTimePicker } from "@/src/components/DateTimePicker";
import { DateRangePicker } from "@/src/components/DateRangePicker";
import { renderWithTrap, useTouchEnv } from "./touchEnv";

vi.mock("@/src/providers/ThemeContext", () => ({ useTheme: () => ({ isDark: false }) }));
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });

describe("a picker sheet opened from inside another sheet", () => {
    useTouchEnv({ now: "2026-03-01T15:00:00Z", providerZone: "America/Bogota" });

    function renderFilters() {
        const onCloseFilters = vi.fn();
        const onChange = vi.fn();
        renderWithTrap(
            <Sheet title="Filtros" onClose={onCloseFilters}>
                <DateTimePicker date={undefined} mode="localDate" onChange={onChange} testId="date-filter" />
            </Sheet>,
        );
        fireEvent.click(screen.getByTestId("date-filter"));
        return { onCloseFilters, onChange };
    }

    it("renders above the sheet it came from", () => {
        renderFilters();
        expect(screen.getAllByRole("dialog")).toHaveLength(2);
        const scrims = screen.getAllByTestId("sheet-scrim");
        expect(scrims.at(-1)).toContainElement(screen.getByRole("dialog", { name: "Fecha" }));
    });

    it("Back closes only the picker", async () => {
        const { onCloseFilters } = renderFilters();
        expect(screen.getByRole("dialog", { name: "Fecha" })).toBeInTheDocument();
        await act(async () => {
            window.history.back();
            await new Promise((resolve) => setTimeout(resolve, 20));
        });
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Fecha" })).toBeNull());
        expect(onCloseFilters).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog", { name: "Filtros" })).toBeInTheDocument();
    });

    it("Escape closes only the picker, and picking leaves the outer sheet open", async () => {
        const { onCloseFilters, onChange } = renderFilters();
        fireEvent.keyDown(screen.getByRole("dialog", { name: "Fecha" }), { key: "Escape" });
        expect(screen.queryByRole("dialog", { name: "Fecha" })).toBeNull();
        expect(onCloseFilters).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId("date-filter"));
        fireEvent.click(within(screen.getByRole("dialog", { name: "Fecha" })).getByRole("button", { name: / 1 de marzo de 2026/ }));
        await waitFor(() => expect(onChange).toHaveBeenCalledWith("2026-03-01"));
        expect(onCloseFilters).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog", { name: "Filtros" })).toBeInTheDocument();
    });
});

describe("picker sheets and URL writes", () => {
    useTouchEnv({ now: "2026-03-01T15:00:00Z", providerZone: "America/Bogota" });

    function writeUrl(param: string, value: string) {
        window.history.replaceState(window.history.state, "", `?${param}=${value}`);
    }

    it("emits after the picker's history entry is gone, so a URL write lands on the page's entry", async () => {
        window.history.replaceState(null, "", "/appointments");
        const seen: (string | undefined)[] = [];
        renderWithTrap(
            <DateTimePicker date={undefined} mode="localDate" testId="date-filter"
                onChange={(day) => { seen.push(window.history.state?.overlay); writeUrl("apptDate", day); }} />,
        );
        fireEvent.click(screen.getByTestId("date-filter"));
        expect(window.history.state?.overlay).toBeDefined();
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: / 1 de marzo de 2026/ }));

        await waitFor(() => expect(seen).toHaveLength(1));
        expect(seen[0]).toBeUndefined();
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(window.location.search).toBe("?apptDate=2026-03-01");
    });

    it("inside the filter sheet, Personalizado writes onto the filter sheet's entry, not the picker's", async () => {
        window.history.replaceState(null, "", "/appointments");
        const seen: (string | undefined)[] = [];
        renderWithTrap(
            <Sheet title="Filtros" onClose={() => {}}>
                <DateRangePicker value={null} testId="range"
                    onChange={(range) => { seen.push(window.history.state?.overlay); if (range) writeUrl("apptDate", range.join(",")); }} />
            </Sheet>,
        );
        const filtersEntry = window.history.state?.overlay;
        expect(filtersEntry).toBeDefined();
        fireEvent.click(within(screen.getByTestId("range")).getByRole("button", { name: "Personalizado" }));
        fireEvent.click(screen.getByTestId("range-from"));
        fireEvent.click(within(screen.getByRole("dialog", { name: "Desde" })).getByRole("button", { name: / 2 de marzo de 2026/ }));
        await waitFor(() => expect(screen.getByTestId("range-from")).toHaveTextContent("02/03/2026"));
        fireEvent.click(screen.getByTestId("range-to"));
        fireEvent.click(within(screen.getByRole("dialog", { name: "Hasta" })).getByRole("button", { name: / 5 de marzo de 2026/ }));

        await waitFor(() => expect(seen).toHaveLength(1));
        expect(seen[0]).toBe(filtersEntry);
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(window.location.search).toBe("?apptDate=2026-03-02,2026-03-05");
        expect(screen.getByRole("dialog", { name: "Filtros" })).toBeInTheDocument();
    });
});
