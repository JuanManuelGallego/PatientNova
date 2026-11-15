import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ServicesSettingsPage from "@/src/app/(provider)/(protected)/settings/services/page";

let typesData: { id: string }[] | undefined;
const scrollIntoView = vi.fn();

vi.mock("@/src/api/appointment-types/useFetchAppointmentTypes", () => ({
    useFetchAppointmentTypes: () => ({ data: typesData, appointmentTypes: typesData ?? [], loading: !typesData, error: null, fetchAppointmentTypes: vi.fn() }),
}));
vi.mock("@/src/api/locations/useFetchLocations", () => ({
    useFetchLocations: () => ({ data: [ { id: "l1" } ], locations: [ { id: "l1" } ], loading: false, error: null, fetchLocations: vi.fn() }),
}));
vi.mock("@/src/components/LocationCard", () => ({ LocationCard: () => <div /> }));
vi.mock("@/src/components/AppointmentTypeCard", () => ({ AppointmentTypeCard: () => <div /> }));

beforeEach(() => {
    typesData = undefined;
    scrollIntoView.mockReset();
    Element.prototype.scrollIntoView = scrollIntoView;
    window.location.hash = "#locations";
});
afterEach(() => { window.location.hash = ""; });

describe("Servicios anchors", () => {
    it("scrolls to #locations only once the list above it has loaded", () => {
        const { rerender } = render(<ServicesSettingsPage />);
        expect(scrollIntoView).not.toHaveBeenCalled();

        typesData = [ { id: "t1" } ];
        rerender(<ServicesSettingsPage />);
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        expect(scrollIntoView.mock.contexts[ 0 ]).toHaveAttribute("id", "locations");

        rerender(<ServicesSettingsPage />);
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });
});
