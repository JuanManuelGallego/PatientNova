import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnlineBookingTab } from "@/src/components/Settings/OnlineBookingTab";
import type { AvailabilityRule, BookingSettings } from "@/src/types/Booking";

const updateSettings = vi.fn();
const saveAvailability = vi.fn();
const fetchSettings = vi.fn();
let settings: BookingSettings;
let rules: AvailabilityRule[];
let suggestion: string | null;

vi.mock("@/src/api/booking/useFetchBookingSettings", () => ({
    useFetchBookingSettings: () => ({ settings, loading: false, error: null, fetchSettings }),
}));
vi.mock("@/src/api/booking/useUpdateBookingSettings", () => ({
    useUpdateBookingSettings: () => ({ updateSettings, loading: false, error: null }),
}));
vi.mock("@/src/api/booking/useFetchSlugSuggestion", () => ({
    useFetchSlugSuggestion: (enabled: boolean) => ({ suggestion: enabled ? suggestion : null, loading: false }),
}));
vi.mock("@/src/api/booking/useFetchAvailability", () => ({
    useFetchAvailability: () => ({ availability: { timezone: "America/Bogota", rules }, loading: false, error: null, fetchAvailability: vi.fn() }),
}));
vi.mock("@/src/api/booking/useSaveAvailability", () => ({
    useSaveAvailability: () => ({ saveAvailability, loading: false, error: null }),
}));

function makeSettings(overrides: Partial<BookingSettings> = {}): BookingSettings {
    return {
        timezone: "America/Bogota",
        bookingSlug: null,
        bookingUrl: null,
        bookingEnabled: false,
        bookingApprovalMode: "AUTO_CONFIRM",
        slotIntervalMinutes: 30,
        bufferMinutes: 0,
        minLeadMinutes: 120,
        maxHorizonDays: 60,
        readiness: { hasSlug: false, hasAvailability: false, hasBookableType: false, hasBookableLocation: false },
        live: false,
        ...overrides,
    };
}

const READY = { hasSlug: true, hasAvailability: true, hasBookableType: true, hasBookableLocation: true };

beforeEach(() => {
    vi.clearAllMocks();
    settings = makeSettings();
    rules = [];
    suggestion = "test-user";
    updateSettings.mockImplementation(async (body) => ({ ...settings, ...body }));
    saveAvailability.mockImplementation(async (r: AvailabilityRule[]) => ({ timezone: "America/Bogota", rules: r }));
});

describe("OnlineBookingTab: status", () => {
    it("keeps the enable toggle disabled until every readiness item is done", () => {
        render(<OnlineBookingTab />);
        expect(screen.getByTestId("online-booking-enabled-toggle")).toBeDisabled();
        expect(screen.getByText(/Completa los puntos pendientes/)).toBeInTheDocument();
    });

    it("enables booking when ready", async () => {
        settings = makeSettings({ bookingSlug: "dra", bookingUrl: "https://app.test/book/dra", readiness: READY });
        render(<OnlineBookingTab />);
        await userEvent.click(screen.getByTestId("online-booking-enabled-toggle"));
        expect(updateSettings).toHaveBeenCalledWith({ bookingEnabled: true });
    });

    it("always allows disabling", async () => {
        settings = makeSettings({ bookingEnabled: true, readiness: { ...READY, hasBookableType: false } });
        render(<OnlineBookingTab />);
        const toggle = screen.getByTestId("online-booking-enabled-toggle");
        expect(toggle).not.toBeDisabled();
        await userEvent.click(toggle);
        expect(updateSettings).toHaveBeenCalledWith({ bookingEnabled: false });
    });

    it("shows the server error when enabling fails", async () => {
        settings = makeSettings({ readiness: READY });
        updateSettings.mockRejectedValue(new Error("Completa la configuración antes de activar la reserva en línea."));
        render(<OnlineBookingTab />);
        await userEvent.click(screen.getByTestId("online-booking-enabled-toggle"));
        expect(await screen.findByRole("alert")).toHaveTextContent("Completa la configuración");
    });

    it("disables the toggle while the request is in flight", async () => {
        settings = makeSettings({ readiness: READY });
        let resolve!: (s: BookingSettings) => void;
        updateSettings.mockImplementation(() => new Promise((r) => { resolve = r; }));
        render(<OnlineBookingTab />);
        const toggle = screen.getByTestId("online-booking-enabled-toggle");
        await userEvent.click(toggle);
        expect(toggle).toBeDisabled();
        await act(async () => resolve({ ...settings, bookingEnabled: true, live: true }));
        expect(toggle).not.toBeDisabled();
        expect(updateSettings).toHaveBeenCalledTimes(1);
    });

    it("warns when booking is enabled but not live", () => {
        settings = makeSettings({ bookingEnabled: true, live: false, readiness: { ...READY, hasBookableLocation: false } });
        render(<OnlineBookingTab />);
        expect(screen.getByTestId("online-booking-not-live")).toHaveTextContent(/no recibe reservas/);
    });

    it("does not warn when booking is live", () => {
        settings = makeSettings({ bookingEnabled: true, live: true, readiness: READY });
        render(<OnlineBookingTab />);
        expect(screen.queryByTestId("online-booking-not-live")).not.toBeInTheDocument();
    });

    it("refreshes readiness after saving availability, even after another section saved", async () => {
        render(<OnlineBookingTab />);
        // Saving the link stores the server's answer locally.
        await userEvent.click(screen.getByTestId("online-booking-slug-save"));
        fetchSettings.mockResolvedValue(makeSettings({
            bookingSlug: "test-user",
            readiness: { ...READY, hasBookableType: false },
        }));
        await userEvent.click(screen.getByTestId("availability-add-1"));
        await userEvent.click(screen.getByTestId("availability-save"));
        const readiness = screen.getByTestId("online-booking-readiness");
        expect(await within(readiness).findAllByText("(listo)")).toHaveLength(3);
    });

    it("says so when readiness can't be refreshed after saving availability", async () => {
        fetchSettings.mockResolvedValue(undefined);
        render(<OnlineBookingTab />);
        await userEvent.click(screen.getByTestId("availability-add-1"));
        await userEvent.click(screen.getByTestId("availability-save"));
        expect(await screen.findByRole("alert")).toBeInTheDocument();
    });
});

describe("OnlineBookingTab: link", () => {
    it("prefills the suggestion when there is no slug and saves it", async () => {
        render(<OnlineBookingTab />);
        expect(screen.getByTestId("online-booking-slug-input")).toHaveValue("test-user");
        await userEvent.click(screen.getByTestId("online-booking-slug-save"));
        expect(updateSettings).toHaveBeenCalledWith({ bookingSlug: "test-user" });
    });

    it("validates the slug before saving", async () => {
        render(<OnlineBookingTab />);
        const input = screen.getByTestId("online-booking-slug-input");
        await userEvent.clear(input);
        await userEvent.type(input, "dra maría");
        expect(screen.getByRole("alert")).toHaveTextContent(/letras minúsculas/);
        expect(screen.getByTestId("online-booking-slug-save")).toBeDisabled();
    });

    it("warns that renaming breaks shared links", async () => {
        settings = makeSettings({ bookingSlug: "dra", bookingUrl: "https://app.test/book/dra" });
        render(<OnlineBookingTab />);
        expect(screen.queryByTestId("online-booking-slug-warning")).not.toBeInTheDocument();
        await userEvent.type(screen.getByTestId("online-booking-slug-input"), "-nueva");
        expect(screen.getByTestId("online-booking-slug-warning")).toHaveTextContent(/dejarán de funcionar/);
    });

    it("warns that clearing the slug disables booking", async () => {
        settings = makeSettings({ bookingSlug: "dra", bookingUrl: "https://app.test/book/dra" });
        render(<OnlineBookingTab />);
        expect(screen.queryByTestId("online-booking-slug-clear-warning")).not.toBeInTheDocument();
        await userEvent.clear(screen.getByTestId("online-booking-slug-input"));
        expect(screen.getByTestId("online-booking-slug-clear-warning")).toHaveTextContent(/se desactivará/);
        expect(screen.queryByTestId("online-booking-slug-warning")).not.toBeInTheDocument();
    });

    it("shows the URL, QR and copies the link", async () => {
        const user = userEvent.setup();
        const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
        settings = makeSettings({ bookingSlug: "dra", bookingUrl: "https://app.test/book/dra" });
        render(<OnlineBookingTab />);
        expect(screen.getByTestId("online-booking-url")).toHaveTextContent("https://app.test/book/dra");
        expect(within(screen.getByTestId("online-booking-qr")).getByTitle(/Código QR/)).toBeInTheDocument();
        await user.click(screen.getByTestId("online-booking-copy"));
        expect(writeText).toHaveBeenCalledWith("https://app.test/book/dra");
        expect(await screen.findByText("¡Copiado!")).toBeInTheDocument();
    });
});

describe("OnlineBookingTab: availability", () => {
    it("adds a default window and saves the whole week", async () => {
        render(<OnlineBookingTab />);
        expect(within(screen.getByTestId("availability-day-1")).getByText("No disponible")).toBeInTheDocument();
        await userEvent.click(screen.getByTestId("availability-add-1"));
        expect(screen.getByTestId("availability-start-1-0")).toHaveValue("09:00");
        expect(screen.getByTestId("availability-end-1-0")).toHaveValue("12:00");
        await userEvent.click(screen.getByTestId("availability-save"));
        expect(saveAvailability).toHaveBeenCalledWith([ { weekday: 1, startMinute: 540, endMinute: 720 } ]);
        expect(fetchSettings).toHaveBeenCalled();
    });

    it("blocks saving overlapping windows", async () => {
        rules = [ { weekday: 2, startMinute: 540, endMinute: 720 } ];
        render(<OnlineBookingTab />);
        await userEvent.click(screen.getByTestId("availability-add-2"));
        // jsdom's time input mangles key-by-key typing; set the value like a picker does.
        fireEvent.change(screen.getByTestId("availability-start-2-1"), { target: { value: "10:00" } });
        expect(screen.getByRole("alert")).toHaveTextContent(/superponen el martes/);
        expect(screen.getByTestId("availability-save")).toBeDisabled();
    });

    it("adds a non-overlapping window late in the day", async () => {
        rules = [ { weekday: 3, startMinute: 1200, endMinute: 1410 } ];
        render(<OnlineBookingTab />);
        await userEvent.click(screen.getByTestId("availability-add-3"));
        expect(screen.getByTestId("availability-start-3-1")).toHaveValue("23:30");
        expect(screen.getByTestId("availability-end-3-1")).toHaveValue("00:00");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByTestId("availability-add-3")).toBeDisabled();
    });

    it("removes a window", async () => {
        rules = [ { weekday: 5, startMinute: 600, endMinute: 660 } ];
        render(<OnlineBookingTab />);
        await userEvent.click(screen.getByTestId("availability-remove-5-0"));
        await userEvent.click(screen.getByTestId("availability-save"));
        expect(saveAvailability).toHaveBeenCalledWith([]);
    });
});

describe("OnlineBookingTab: rules", () => {
    it("saves buffer, lead time (hours → minutes) and horizon", async () => {
        render(<OnlineBookingTab />);
        const buffer = screen.getByTestId("online-booking-buffer");
        await userEvent.clear(buffer);
        await userEvent.type(buffer, "15");
        const lead = screen.getByTestId("online-booking-lead");
        await userEvent.clear(lead);
        await userEvent.type(lead, "24");
        await userEvent.click(screen.getByTestId("online-booking-rules-save"));
        expect(updateSettings).toHaveBeenCalledWith({ slotIntervalMinutes: 30, bufferMinutes: 15, minLeadMinutes: 1440, maxHorizonDays: 60 });
    });

    it("disables saving out-of-range values", async () => {
        render(<OnlineBookingTab />);
        const horizon = screen.getByTestId("online-booking-horizon");
        await userEvent.clear(horizon);
        await userEvent.type(horizon, "400");
        expect(screen.getByTestId("online-booking-rules-save")).toBeDisabled();
    });
});
