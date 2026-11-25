import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PracticeProfile as Tab } from "@/src/components/Settings/PracticeProfile";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";

const PracticeProfile = () => <FocusTrapProvider><Tab /></FocusTrapProvider>;

const autosave = {
    saving: false,
    status: "idle" as "idle" | "saved" | "error",
    error: null as string | null,
    schedule: vi.fn(),
    flush: vi.fn(),
};
vi.mock("@/src/api/users/useUpdateProfile", () => ({ useAutoSaveProfile: () => autosave }));
vi.mock("@/src/hooks/useDisplayTimezone", () => ({ useDisplayTimezone: () => "America/Bogota" }));
vi.mock("@/src/providers/AuthContext", () => ({
    useAuthContext: () => ({
        user: { firstName: "Ana", lastName: "Ruiz", displayName: "", jobTitle: "", email: "ana@example.com", timezone: "America/Bogota" },
    }),
}));

beforeEach(() => {
    autosave.saving = false;
    autosave.status = "idle";
    autosave.error = null;
    autosave.schedule.mockReset();
    autosave.flush.mockReset();
});

describe("PracticeProfile", () => {
    it("points to Tipos de paciente, where consent forms now live", () => {
        render(<PracticeProfile />);
        const section = screen.getByRole("region", { name: "Formularios de consentimiento" });
        expect(within(section).getByRole("link", { name: "Tipos de paciente" })).toHaveAttribute("href", "/settings/patient-types");
    });

    it("shows an autosave error only in the section being edited", async () => {
        const { rerender } = render(<PracticeProfile />);
        await userEvent.type(screen.getByTestId("profile-bank-name-input"), "B");
        autosave.error = "Error al guardar";
        rerender(<PracticeProfile />);

        const banking = screen.getByRole("region", { name: "Información bancaria" });
        expect(within(banking).getByRole("alert")).toHaveTextContent("Error al guardar");
        expect(within(screen.getByRole("region", { name: "Logos" })).queryByRole("alert")).toBeNull();
    });

    it("saves only practice fields, keeping earlier edits in the same payload", async () => {
        render(<PracticeProfile />);
        await userEvent.type(screen.getByTestId("profile-bank-name-input"), "B");
        await userEvent.type(screen.getByLabelText("Número de cuenta"), "1");

        const payload = autosave.schedule.mock.calls.at(-1)?.[ 0 ];
        expect(Object.keys(payload).sort()).toEqual([ "accountNumber", "altLogo", "bankName", "bankingKey", "logo", "nationalId" ]);
        expect(payload).toMatchObject({ bankName: "B", accountNumber: "1" });
    });
});
