import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PracticeProfile as ProfileTab } from "@/src/components/Settings/PracticeProfile";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";

const fetchWithAuth = vi.fn();
vi.mock("@/src/api/base/fetchWithAuth", () => ({ fetchWithAuth: (...args: unknown[]) => fetchWithAuth(...args) }));
vi.mock("@/src/api/users/useUpdateProfile", () => ({
    useAutoSaveProfile: () => ({ saving: false, status: "idle", error: null, schedule: vi.fn(), flush: vi.fn() }),
}));
vi.mock("@/src/hooks/useDisplayTimezone", () => ({ useDisplayTimezone: () => "America/Bogota" }));
vi.mock("@/src/providers/AuthContext", () => ({
    useAuthContext: () => ({ user: { firstName: "Ana", lastName: "Ruiz", email: "ana@example.com", timezone: "America/Bogota" } }),
}));

const DOC = { id: "d1", name: "consentimiento.pdf", mimeType: "application/pdf", sizeBytes: 2048, createdAt: "2026-11-01T12:00:00.000Z", updatedAt: "2026-11-01T12:00:00.000Z" };
const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

beforeEach(() => {
    fetchWithAuth.mockReset().mockImplementation(async (_url: string, init?: RequestInit) =>
        init?.method === "DELETE" ? json(500, { error: "boom" }) : json(200, { data: DOC }),
    );
});

const renderTab = () => render(<FocusTrapProvider><ProfileTab /></FocusTrapProvider>);

describe("PracticeProfile consent form (real hook)", () => {
    it("keeps the dialog open with a Spanish error when the server refuses the deletion", async () => {
        renderTab();
        await userEvent.click(await screen.findByRole("button", { name: /Eliminar/ }));
        await userEvent.click(screen.getByTestId("consent-delete-dialog-confirm-button"));

        const dialog = await screen.findByTestId("consent-delete-dialog");
        expect(dialog).toHaveTextContent("No se pudo eliminar el formulario de consentimiento.");
        expect(screen.getByTestId("consent-delete-dialog-confirm-button")).toBeEnabled();
    });

    it("shows why a file that is not a PDF was refused", async () => {
        const { container } = renderTab();
        await screen.findByText("consentimiento.pdf");
        const input = container.querySelector('input[accept=".pdf,application/pdf"]') as HTMLInputElement;
        await userEvent.upload(input, new File([ "x" ], "notas.txt", { type: "text/plain" }), { applyAccept: false });

        expect(await screen.findByRole("alert")).toHaveTextContent("Por favor selecciona un archivo PDF");
    });
});
