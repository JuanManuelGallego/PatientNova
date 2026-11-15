import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocationsTab } from "@/src/components/Settings/LocationsTab";
import { AppointmentTypesTab } from "@/src/components/Settings/AppointmentTypesTab";

const refresh = vi.fn();
vi.mock("@/src/providers/SettingsAttentionContext", () => ({
    useSettingsAttention: () => ({ sections: new Set(), report: vi.fn(), refresh }),
}));
vi.mock("@/src/api/locations/useFetchLocations", () => ({
    useFetchLocations: () => ({ data: [ { id: "l1" } ], locations: [ { id: "l1" } ], loading: false, error: null, fetchLocations: vi.fn() }),
}));
vi.mock("@/src/api/appointment-types/useFetchAppointmentTypes", () => ({
    useFetchAppointmentTypes: () => ({ data: [ { id: "t1" } ], appointmentTypes: [ { id: "t1" } ], loading: false, error: null, fetchAppointmentTypes: vi.fn() }),
}));
vi.mock("@/src/components/LocationCard", () => ({
    LocationCard: ({ onDelete }: { onDelete: () => void }) => <button onClick={onDelete}>borrar ubicación</button>,
}));
vi.mock("@/src/components/AppointmentTypeCard", () => ({
    AppointmentTypeCard: ({ onDelete }: { onDelete: () => void }) => <button onClick={onDelete}>borrar tipo</button>,
}));
vi.mock("@/src/components/Modals/LocationModal", () => ({ LocationModal: ({ onSaved }: { onSaved: () => void }) => <button onClick={onSaved}>guardar</button> }));
vi.mock("@/src/components/Modals/DeleteLocationModal", () => ({ DeleteLocationModal: ({ onDelete }: { onDelete: () => void }) => <button onClick={onDelete}>confirmar</button> }));
vi.mock("@/src/components/Modals/AppointmentTypeModal", () => ({ AppointmentTypeModal: ({ onSaved }: { onSaved: () => void }) => <button onClick={onSaved}>guardar</button> }));
vi.mock("@/src/components/Modals/DeleteAppointmentTypeModal", () => ({ DeleteAppointmentTypeModal: ({ onDelete }: { onDelete: () => void }) => <button onClick={onDelete}>confirmar</button> }));

beforeEach(() => refresh.mockReset());

describe("Servicios refreshes the attention dot", () => {
    it("after saving and after deleting a location", async () => {
        render(<LocationsTab />);
        await userEvent.click(screen.getByTestId("settings-new-location-button"));
        await userEvent.click(screen.getByRole("button", { name: "guardar" }));
        expect(refresh).toHaveBeenCalledTimes(1);

        await userEvent.click(screen.getByRole("button", { name: "borrar ubicación" }));
        await userEvent.click(screen.getByRole("button", { name: "confirmar" }));
        expect(refresh).toHaveBeenCalledTimes(2);
    });

    it("after saving and after deleting an appointment type", async () => {
        render(<AppointmentTypesTab />);
        await userEvent.click(screen.getByTestId("settings-new-type-button"));
        await userEvent.click(screen.getByRole("button", { name: "guardar" }));
        expect(refresh).toHaveBeenCalledTimes(1);

        await userEvent.click(screen.getByRole("button", { name: "borrar tipo" }));
        await userEvent.click(screen.getByRole("button", { name: "confirmar" }));
        expect(refresh).toHaveBeenCalledTimes(2);
    });
});
