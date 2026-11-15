import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocationsTab } from "@/src/components/Settings/LocationsTab";

const fetchLocations = vi.fn();

vi.mock("@/src/api/locations/useFetchLocations", () => ({
    useFetchLocations: () => ({ data: undefined, locations: [], loading: false, error: "Error al cargar los datos", fetchLocations }),
}));
vi.mock("@/src/components/Modals/LocationModal", () => ({ LocationModal: () => null }));
vi.mock("@/src/components/Modals/DeleteLocationModal", () => ({ DeleteLocationModal: () => null }));

describe("LocationsTab", () => {
    it("shows the load error instead of a blank area", () => {
        render(<LocationsTab />);
        expect(screen.getByRole("alert")).toHaveTextContent("Error al cargar los datos");
    });
});
