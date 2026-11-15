import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RemindersTab } from "@/src/components/Settings/RemindersTab";

let portalEnabled = false;
const autosave = { saving: false, status: "idle" as const, error: null as string | null, schedule: vi.fn(), flush: vi.fn() };

vi.mock("@/src/api/users/useUpdateProfile", () => ({ useAutoSaveProfile: () => autosave }));
vi.mock("@/src/providers/AuthContext", () => ({
    useAuthContext: () => ({
        user: { email: "ana@example.com", reminderActive: true, reminderChannel: "WHATSAPP", whatsappNumber: "", phoneNumber: "", portalEnabled },
    }),
}));

beforeEach(() => {
    portalEnabled = false;
    autosave.error = null;
    autosave.schedule.mockReset();
    autosave.flush.mockReset();
});

describe("RemindersTab", () => {
    it("shows an invalid WhatsApp number under the WhatsApp field", async () => {
        render(<RemindersTab />);
        const input = within(screen.getByTestId("reminders-whatsapp-input")).getByRole("textbox");
        await userEvent.type(input, "12345678901234567");

        expect(screen.getByText("Por favor, ingresa un número de WhatsApp válido (formato E.164).")).toHaveAttribute("id", "reminders-whatsapp-error");
        expect(input).toHaveAttribute("aria-describedby", "reminders-whatsapp-error");
    });

    it("links the portal reminder hint to Reserva en línea when the portal is on", () => {
        portalEnabled = true;
        render(<RemindersTab />);
        expect(screen.getByRole("link", { name: "Reserva en línea" })).toHaveAttribute("href", "/settings?tab=Reserva+en+l%C3%ADnea");
    });

    it("has no Reserva en línea link when the portal is off", () => {
        render(<RemindersTab />);
        expect(screen.queryByRole("link", { name: "Reserva en línea" })).toBeNull();
    });

    it("frames the settings as the Tus avisos section", () => {
        render(<RemindersTab />);
        expect(screen.getByRole("region", { name: "Tus avisos" })).toBeInTheDocument();
    });
});
