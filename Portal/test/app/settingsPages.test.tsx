import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn();
let portalEnabled = false;
const mutate = vi.fn();

vi.mock("next/navigation", () => ({ redirect: (path: string) => redirect(path), usePathname: () => "/settings/account", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/src/providers/AuthContext", () => ({
    useAuthContext: () => ({
        user: { role: "ADMIN", portalEnabled, firstName: "Ana", lastName: "Ruiz", email: "ana@example.com", timezone: "America/Bogota" },
        updateUser: vi.fn(),
    }),
}));
vi.mock("@/src/api/base/useApiMutation", () => ({
    useApiMutation: () => ({ mutate, loading: false, error: null }),
}));
vi.mock("@/src/components/Settings/OnlineBookingTab", () => ({ OnlineBookingTab: () => <div data-testid="online-booking-tab" /> }));

beforeEach(() => {
    redirect.mockReset();
    mutate.mockReset().mockResolvedValue({});
    portalEnabled = false;
});

describe("settings pages", () => {
    it("sends /settings to the account page", async () => {
        const { default: SettingsIndex } = await import("@/src/app/(provider)/(protected)/settings/page");
        SettingsIndex();
        expect(redirect).toHaveBeenCalledWith("/settings/account");
    });

    it("explains that online booking is off instead of showing the tab", async () => {
        const { default: BookingPage } = await import("@/src/app/(provider)/(protected)/settings/booking/page");
        render(<BookingPage />);
        expect(screen.getByTestId("settings-booking-unavailable")).toHaveTextContent("La reserva en línea no está activada para tu cuenta.");
        expect(screen.queryByTestId("online-booking-tab")).toBeNull();
    });

    it("shows online booking when the portal is on", async () => {
        portalEnabled = true;
        const { default: BookingPage } = await import("@/src/app/(provider)/(protected)/settings/booking/page");
        render(<BookingPage />);
        expect(screen.getByTestId("online-booking-tab")).toBeInTheDocument();
    });

    it("keeps an edit typed just before leaving the page", async () => {
        const { AccountProfile } = await import("@/src/components/Settings/AccountProfile");
        const { unmount } = render(<AccountProfile />);
        await userEvent.type(screen.getByTestId("profile-first-name-input"), "X");
        expect(mutate).not.toHaveBeenCalled();
        unmount();

        await waitFor(() =>
            expect(mutate).toHaveBeenCalledWith(expect.stringContaining("/users/me"), expect.objectContaining({ firstName: "AnaX" })),
            { timeout: 300 });
    });
});
