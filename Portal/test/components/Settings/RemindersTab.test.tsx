import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RemindersTab } from "@/src/components/Settings/RemindersTab";

let portalEnabled = false;
let userOverrides: Record<string, unknown> = {};
const autosave = { saving: false, status: "idle" as const, error: null as string | null, schedule: vi.fn(), flush: vi.fn() };

vi.mock("@/src/api/users/useUpdateProfile", () => ({ useAutoSaveProfile: () => autosave }));
vi.mock("@/src/providers/AuthContext", () => ({
    useAuthContext: () => ({
        user: { email: "ana@example.com", reminderActive: true, reminderChannel: "WHATSAPP", whatsappNumber: "", phoneNumber: "", portalEnabled, ...userOverrides },
    }),
}));

beforeEach(() => {
    portalEnabled = false;
    userOverrides = {};
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

    it("warns under the WhatsApp field when notices go to WhatsApp and there is no number", async () => {
        render(<RemindersTab />);
        const warning = screen.getByText("No tienes un número de WhatsApp. No recibirás avisos hasta que lo agregues.");
        expect(warning).toHaveAttribute("role", "status");
        expect(screen.queryByText(/número para SMS/)).toBeNull();
        await userEvent.type(within(screen.getByTestId("reminders-whatsapp-input")).getByRole("textbox"), "3001234567");
        expect(screen.queryByText(/No tienes un número de WhatsApp/)).toBeNull();
    });

    it("warns under the SMS field when the channel is SMS and there is no phone", () => {
        userOverrides = { reminderChannel: "SMS" };
        render(<RemindersTab />);
        expect(screen.getByText("No tienes un número para SMS. No recibirás avisos hasta que lo agregues.")).toHaveAttribute("role", "status");
        expect(screen.queryByText(/número de WhatsApp\. No/)).toBeNull();
    });

    it("does not warn when the number exists, the channel is email, or notices are off", () => {
        userOverrides = { whatsappNumber: "+573001234567" };
        const { unmount } = render(<RemindersTab />);
        expect(screen.queryByText(/No recibirás avisos/)).toBeNull();
        unmount();
        userOverrides = { reminderChannel: "EMAIL" };
        const second = render(<RemindersTab />);
        expect(screen.queryByText(/No recibirás avisos/)).toBeNull();
        second.unmount();
        userOverrides = { reminderActive: false };
        render(<RemindersTab />);
        expect(screen.queryByText(/No recibirás avisos/)).toBeNull();
    });

    it("links the portal reminder hint to Reserva en línea when the portal is on", () => {
        portalEnabled = true;
        render(<RemindersTab />);
        expect(screen.getByRole("link", { name: "Reserva en línea" })).toHaveAttribute("href", "/settings/booking");
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
