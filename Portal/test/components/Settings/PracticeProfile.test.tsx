import { act, render, screen, within } from "@testing-library/react";
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
const consent = {
    document: { name: "consentimiento.pdf", sizeBytes: 2048, updatedAt: "2026-11-01T12:00:00.000Z" } as unknown,
    loading: false,
    fetchDocument: vi.fn(),
    uploadDocument: vi.fn(),
    deleteDocument: vi.fn(),
};

vi.mock("@/src/api/users/useUpdateProfile", () => ({ useAutoSaveProfile: () => autosave }));
vi.mock("@/src/api/consent/useConsentDocument", () => ({ useConsentDocument: () => consent }));
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
    consent.deleteDocument.mockReset().mockResolvedValue(undefined);
});

const consentSection = () => screen.getByRole("region", { name: "Formulario de consentimiento" });

describe("PracticeProfile", () => {
    it("asks before deleting the consent form and deletes only on confirm", async () => {
        render(<PracticeProfile />);
        await userEvent.click(within(consentSection()).getByRole("button", { name: /Eliminar/ }));

        const dialog = screen.getByTestId("consent-delete-dialog");
        expect(dialog).toHaveTextContent("consentimiento.pdf");
        expect(consent.deleteDocument).not.toHaveBeenCalled();

        await userEvent.click(screen.getByTestId("consent-delete-dialog-confirm-button"));
        expect(consent.deleteDocument).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId("consent-delete-dialog")).toBeNull();
    });

    it("keeps the form when the deletion is cancelled", async () => {
        render(<PracticeProfile />);
        await userEvent.click(within(consentSection()).getByRole("button", { name: /Eliminar/ }));
        await userEvent.click(screen.getByTestId("consent-delete-dialog-cancel-button"));

        expect(screen.queryByTestId("consent-delete-dialog")).toBeNull();
        expect(consent.deleteDocument).not.toHaveBeenCalled();
    });

    it("keeps the dialog open with the error when deletion fails", async () => {
        consent.deleteDocument.mockRejectedValue(new Error("No se pudo eliminar"));
        render(<PracticeProfile />);
        await userEvent.click(within(consentSection()).getByRole("button", { name: /Eliminar/ }));
        await userEvent.click(screen.getByTestId("consent-delete-dialog-confirm-button"));

        const dialog = screen.getByTestId("consent-delete-dialog");
        expect(dialog).toHaveTextContent("No se pudo eliminar");
    });

    it("stays open while deleting, so a late failure is still shown", async () => {
        let fail: (e: Error) => void = () => {};
        consent.deleteDocument.mockReturnValue(new Promise((_, reject) => { fail = reject; }));
        render(<PracticeProfile />);
        await userEvent.click(within(consentSection()).getByRole("button", { name: /Eliminar/ }));
        await userEvent.click(screen.getByTestId("consent-delete-dialog-confirm-button"));

        await userEvent.keyboard("{Escape}");
        expect(screen.getByTestId("consent-delete-dialog")).toBeInTheDocument();

        await act(async () => fail(new Error("No se pudo eliminar el formulario de consentimiento.")));
        expect(screen.getByTestId("consent-delete-dialog")).toHaveTextContent("No se pudo eliminar el formulario de consentimiento.");
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
