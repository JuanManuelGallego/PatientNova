import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocationModal } from "@/src/components/Modals/LocationModal";
import { AppointmentTypeModal } from "@/src/components/Modals/AppointmentTypeModal";

const createLocation = vi.fn();
const updateLocation = vi.fn();
const createAppointmentType = vi.fn();

vi.mock("@/src/providers/AuthContext", () => ({
    useAuthContext: () => ({ user: { role: "ADMIN" } }),
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
});

describe("LocationModal bookable toggle", () => {
    it("sends bookableOnline for an in-person location", async () => {
        render(<LocationModal onClose={vi.fn()} onSaved={vi.fn()} />);
        await userEvent.type(screen.getByTestId("location-name-input"), "Centro");
        await userEvent.type(screen.getByTestId("location-address-input"), "Calle 1");
        await userEvent.type(screen.getByTestId("location-instructions-input"), "Piso 2");
        await userEvent.click(screen.getByTestId("location-bookable-online-checkbox"));
        await userEvent.click(screen.getByTestId("location-modal-submit-button"));
        expect(createLocation).toHaveBeenCalledWith(expect.objectContaining({ bookableOnline: true, isVirtual: false }));
    });

    it("stays available for virtual locations and explains where the link comes from", async () => {
        render(<LocationModal onClose={vi.fn()} onSaved={vi.fn()} location={{ id: "l1", name: "Sala", isVirtual: false, address: "x", instructions: "y", bookableOnline: true }} />);
        const toggle = screen.getByTestId("location-bookable-online-checkbox");
        await userEvent.click(screen.getByTestId("location-virtual-checkbox"));
        expect(toggle).toBeEnabled();
        expect(toggle).toBeChecked();
        expect(screen.getByText(/crearemos el enlace de Meet; si no, deberás agregarlo tú/)).toBeInTheDocument();
        await userEvent.click(screen.getByTestId("location-modal-submit-button"));
        expect(updateLocation).toHaveBeenCalledWith("l1", expect.objectContaining({ isVirtual: true, bookableOnline: true }));
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
});
