import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountProfile } from "@/src/components/Settings/AccountProfile";

const autosave = { saving: false, status: "idle" as const, error: null as string | null, schedule: vi.fn(), flush: vi.fn() };

vi.mock("@/src/api/users/useUpdateProfile", () => ({ useAutoSaveProfile: () => autosave }));
vi.mock("@/src/api/consent/useConsentDocument", () => ({
    useConsentDocument: () => ({ document: null, loading: false, fetchDocument: vi.fn(), uploadDocument: vi.fn(), deleteDocument: vi.fn() }),
}));
vi.mock("@/src/hooks/useDisplayTimezone", () => ({ useDisplayTimezone: () => "America/Bogota" }));
vi.mock("@/src/providers/AuthContext", () => ({
    useAuthContext: () => ({
        user: { firstName: "Ana", lastName: "Ruiz", displayName: "", jobTitle: "", email: "ana@example.com", timezone: "America/Bogota", bankName: "Banco" },
    }),
}));

beforeEach(() => autosave.schedule.mockReset());

describe("AccountProfile", () => {
    it("saves only account fields, all of them each time", async () => {
        render(<AccountProfile />);
        await userEvent.type(screen.getByTestId("profile-first-name-input"), "X");

        const payload = autosave.schedule.mock.calls.at(-1)?.[ 0 ];
        expect(Object.keys(payload).sort()).toEqual([ "avatar", "displayName", "firstName", "jobTitle", "lastName", "timezone" ]);
        expect(payload.firstName).toBe("AnaX");
    });

    it("shows the account email read-only", () => {
        render(<AccountProfile />);
        const email = screen.getByTestId("profile-email");
        expect(email).toHaveValue("ana@example.com");
        expect(email).toBeDisabled();
    });
});
