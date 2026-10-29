import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocationModal } from "@/src/components/Modals/LocationModal";
import { AppointmentTypeModal } from "@/src/components/Modals/AppointmentTypeModal";

const createLocation = vi.fn();
const updateLocation = vi.fn();
const createAppointmentType = vi.fn();
let portalEnabled = true;

vi.mock("@/src/providers/AuthContext", () => ({
    useAuthContext: () => ({ user: { role: "ADMIN", portalEnabled } }),
}));
vi.mock("@/src/hooks/useFocusTrap", () => ({
    useFocusTrap: () => ({ ref: { current: null }, handleKeyDown: vi.fn() }),
}));
vi.mock("@/src/api/locations/useCreateLocation", () => ({ useCreateLocation: () => ({ createLocation }) }));
vi.mock("@/src/api/locations/useUpdateLocation", () => ({ useUpdateLocation: () => ({ updateLocation }) }));
vi.mock("@/src/api/appointment-types/useCreateAppointmentType", () => ({ useCreateAppointmentType: () => ({ createAppointmentType }) }));
vi.mock("@/src/api/appointment-types/useUpdateAppointmentType", () => ({ useUpdateAppointmentType: () => ({ updateAppointmentType: vi.fn() }) }));

beforeEach(() => {
    vi.clearAllMocks();
    portalEnabled = true;
});

describe("LocationModal bookable toggle", () => {
    it("is hidden and never sent when the portal is off", async () => {
        portalEnabled = false;
        render(<LocationModal onClose={vi.fn()} onSaved={vi.fn()} location={{ id: "l1", name: "Centro", isVirtual: true }} />);
        expect(screen.queryByTestId("location-bookable-online-checkbox")).not.toBeInTheDocument();
        await userEvent.click(screen.getByTestId("location-modal-submit-button"));
        expect(updateLocation.mock.calls[ 0 ][ 1 ]).not.toHaveProperty("bookableOnline");
    });

    it("sends bookableOnline for an in-person location", async () => {
        render(<LocationModal onClose={vi.fn()} onSaved={vi.fn()} />);
        await userEvent.type(screen.getByTestId("location-name-input"), "Centro");
        await userEvent.type(screen.getByTestId("location-address-input"), "Calle 1");
        await userEvent.type(screen.getByTestId("location-instructions-input"), "Piso 2");
        await userEvent.click(screen.getByTestId("location-bookable-online-checkbox"));
        await userEvent.click(screen.getByTestId("location-modal-submit-button"));
        expect(createLocation).toHaveBeenCalledWith(expect.objectContaining({ bookableOnline: true, isVirtual: false }));
    });

    it("is disabled and cleared for virtual locations", async () => {
        render(<LocationModal onClose={vi.fn()} onSaved={vi.fn()} location={{ id: "l1", name: "Sala", isVirtual: false, address: "x", instructions: "y", bookableOnline: true }} />);
        const toggle = screen.getByTestId("location-bookable-online-checkbox");
        expect(toggle).toBeChecked();
        await userEvent.click(screen.getByTestId("location-virtual-checkbox"));
        expect(toggle).toBeDisabled();
        expect(toggle).not.toBeChecked();
        expect(screen.getByText(/virtuales estarán disponibles más adelante/)).toBeInTheDocument();
        await userEvent.click(screen.getByTestId("location-modal-submit-button"));
        expect(updateLocation).toHaveBeenCalledWith("l1", expect.objectContaining({ isVirtual: true, bookableOnline: false }));
    });
});

describe("AppointmentTypeModal bookable toggle", () => {
    it("sends bookableOnline when the portal is on", async () => {
        render(<AppointmentTypeModal onClose={vi.fn()} onSaved={vi.fn()} />);
        await userEvent.type(screen.getByTestId("appointment-type-name-input"), "Primera vez");
        await userEvent.click(screen.getByTestId("appointment-type-bookable-online-checkbox"));
        await userEvent.click(screen.getByTestId("appointment-type-submit-button"));
        expect(createAppointmentType).toHaveBeenCalledWith(expect.objectContaining({ bookableOnline: true }));
    });

    it("is hidden when the portal is off", () => {
        portalEnabled = false;
        render(<AppointmentTypeModal onClose={vi.fn()} onSaved={vi.fn()} />);
        expect(screen.queryByTestId("appointment-type-bookable-online-checkbox")).not.toBeInTheDocument();
    });
});
