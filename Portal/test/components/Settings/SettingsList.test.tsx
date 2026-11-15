import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapPin } from "lucide-react";
import { SettingsList } from "@/src/components/Settings/SettingsList";

type Item = { id: string; name: string };

const onNew = vi.fn();
const onRetry = vi.fn();

function renderList(props: { items: Item[] | undefined; loading?: boolean; error?: string | null }) {
    return render(
        <SettingsList<Item>
            title="Ubicaciones de citas"
            description="Configura los lugares donde atiendes pacientes"
            newLabel="Nueva ubicación"
            newTestId="settings-new-location-button"
            onNew={onNew}
            items={props.items}
            loading={props.loading ?? false}
            error={props.error ?? null}
            onRetry={onRetry}
            empty={{ icon: MapPin, title: "Sin ubicaciones configuradas", sub: "Agrega los lugares o salas donde atiendes a tus pacientes." }}
            renderItem={(item) => <div data-testid={`item-${item.id}`}>{item.name}</div>}
        />,
    );
}

beforeEach(() => {
    vi.useFakeTimers();
    onNew.mockReset();
    onRetry.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("SettingsList", () => {
    it("shows a skeleton only after the loading delay", () => {
        renderList({ items: undefined, loading: true });
        act(() => vi.advanceTimersByTime(100));
        expect(screen.queryByTestId("settings-list-skeleton")).toBeNull();
        act(() => vi.advanceTimersByTime(150));
        expect(screen.getByTestId("settings-list-skeleton")).toHaveAttribute("aria-busy", "true");
    });

    it("keeps the items on screen while they reload", () => {
        renderList({ items: [ { id: "a", name: "Consultorio" } ], loading: true });
        act(() => vi.advanceTimersByTime(500));
        expect(screen.getByTestId("item-a")).toBeInTheDocument();
        expect(screen.queryByTestId("settings-list-skeleton")).toBeNull();
    });

    it("shows the load error with Reintentar when nothing has loaded", () => {
        renderList({ items: undefined, error: "Error al cargar los datos" });
        expect(screen.getByRole("alert")).toHaveTextContent("Error al cargar los datos");
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("shows the empty state when the list is empty", () => {
        renderList({ items: [] });
        expect(screen.getByText("Sin ubicaciones configuradas")).toBeInTheDocument();
        expect(screen.getByText("Agrega los lugares o salas donde atiendes a tus pacientes.")).toBeInTheDocument();
    });

    it("puts the Nuevo button in the header", () => {
        renderList({ items: [] });
        const button = screen.getByTestId("settings-new-location-button");
        expect(button).toHaveTextContent("Nueva ubicación");
        fireEvent.click(button);
        expect(onNew).toHaveBeenCalledTimes(1);
    });
});
