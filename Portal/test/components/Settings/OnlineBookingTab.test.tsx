import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { OnlineBookingTab } from "@/src/components/Settings/OnlineBookingTab";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";
import { AUTO_SAVE_DEBOUNCE_MS } from "@/src/hooks/useDebouncedSave";
import type { AvailabilityRule, BookingSettings } from "@/src/types/Booking";
import type { AppointmentType } from "@/src/types/Appointment";

const updateSettings = vi.fn();
const saveAvailability = vi.fn();
const fetchSettings = vi.fn();
let settings: BookingSettings;
let rules: AvailabilityRule[];
let suggestion: string | null;
let appointmentTypes: AppointmentType[];
let user: UserEvent;

vi.mock("@/src/providers/ThemeContext", () => ({
    useTheme: () => ({ isDark: false }),
}));
// The antd popup needs browser APIs jsdom lacks; a plain input feeds the same UTC-mode dayjs values.
vi.mock("@/src/components/ZonedDatePicker", async () => {
    const { default: dayjs } = await import("dayjs");
    const { default: utc } = await import("dayjs/plugin/utc");
    dayjs.extend(utc);
    type Props = { value: import("dayjs").Dayjs; onChange: (d: import("dayjs").Dayjs) => void; "aria-label": string; "aria-invalid": boolean; "data-testid": string };
    return {
        ZonedDatePicker: {
            TimePicker: ({ value, onChange, ...rest }: Props) => (
                <input
                    value={value.format("HH:mm")}
                    onChange={(e) => onChange(dayjs.utc(`2000-01-01T${e.target.value}:00`))}
                    aria-label={rest[ "aria-label" ]}
                    aria-invalid={rest[ "aria-invalid" ]}
                    data-testid={rest[ "data-testid" ]}
                />
            ),
        },
    };
});
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
vi.mock("@/src/api/appointment-types/useFetchAppointmentTypes", () => ({
    useFetchAppointmentTypes: () => ({ appointmentTypes, loading: false, error: null, fetchAppointmentTypes: vi.fn() }),
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
        maxPatientReschedules: 2,
        minRescheduleNoticeHours: 0,
        portalReminderTiming: "ONE_DAY_BEFORE",
        bio: null,
        specialty: null,
        publicPhone: null,
        publicWhatsapp: null,
        legalName: null,
        privacyContact: null,
        contactHours: null,
        readiness: { hasSlug: false, hasLegalIdentity: false, hasAvailability: false, hasBookableType: false, hasBookableLocation: false },
        live: false,
        ...overrides,
    };
}

const READY = { hasSlug: true, hasLegalIdentity: true, hasAvailability: true, hasBookableType: true, hasBookableLocation: true };
const WITH_LINK = { bookingSlug: "dra", bookingUrl: "https://app.test/book/dra" };

const renderTab = () => render(<FocusTrapProvider><OnlineBookingTab /></FocusTrapProvider>);

async function settle(ms = AUTO_SAVE_DEBOUNCE_MS) {
    await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

const testGlobal = globalThis as { jest?: unknown };
beforeAll(() => { testGlobal.jest = { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) }; });
afterAll(() => { delete testGlobal.jest; });

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    settings = makeSettings();
    rules = [];
    suggestion = "test-user";
    appointmentTypes = [];
    updateSettings.mockImplementation(async (body) => ({ ...settings, ...body }));
    saveAvailability.mockImplementation(async (r: AvailabilityRule[]) => ({ timezone: "America/Bogota", rules: r }));
    fetchSettings.mockImplementation(async () => settings);
});

afterEach(() => {
    vi.useRealTimers();
});

describe("OnlineBookingTab: status", () => {
    it("keeps the enable toggle disabled until every readiness item is done", () => {
        renderTab();
        expect(screen.getByTestId("online-booking-enabled-toggle")).toBeDisabled();
        expect(screen.getByText(/Completa los puntos pendientes/)).toBeInTheDocument();
    });

    it("enables booking when ready", async () => {
        settings = makeSettings({ ...WITH_LINK, readiness: READY });
        renderTab();
        await user.click(screen.getByTestId("online-booking-enabled-toggle"));
        expect(updateSettings).toHaveBeenCalledWith({ bookingEnabled: true });
    });

    it("always allows disabling", async () => {
        settings = makeSettings({ bookingEnabled: true, readiness: { ...READY, hasBookableType: false } });
        renderTab();
        const toggle = screen.getByTestId("online-booking-enabled-toggle");
        expect(toggle).not.toBeDisabled();
        await user.click(toggle);
        expect(updateSettings).toHaveBeenCalledWith({ bookingEnabled: false });
    });

    it("shows the server error when enabling fails", async () => {
        settings = makeSettings({ readiness: READY });
        updateSettings.mockRejectedValue(new Error("Completa la configuración antes de activar la reserva en línea."));
        renderTab();
        await user.click(screen.getByTestId("online-booking-enabled-toggle"));
        await settle(0);
        expect(screen.getByRole("alert")).toHaveTextContent("Completa la configuración");
    });

    it("disables the toggle while the request is in flight", async () => {
        settings = makeSettings({ readiness: READY });
        let resolve!: (s: BookingSettings) => void;
        updateSettings.mockImplementation(() => new Promise((r) => { resolve = r; }));
        renderTab();
        const toggle = screen.getByTestId("online-booking-enabled-toggle");
        await user.click(toggle);
        expect(toggle).toBeDisabled();
        await act(async () => resolve({ ...settings, bookingEnabled: true, live: true }));
        expect(toggle).not.toBeDisabled();
        expect(updateSettings).toHaveBeenCalledTimes(1);
    });

    it("warns when booking is enabled but not live", () => {
        settings = makeSettings({ bookingEnabled: true, live: false, readiness: { ...READY, hasBookableLocation: false } });
        renderTab();
        expect(screen.getByTestId("online-booking-not-live")).toHaveTextContent(/no recibe reservas/);
    });

    it("does not warn when booking is live", () => {
        settings = makeSettings({ bookingEnabled: true, live: true, readiness: READY });
        renderTab();
        expect(screen.queryByTestId("online-booking-not-live")).not.toBeInTheDocument();
    });

    it("refreshes readiness after availability autosaves, even after another section saved", async () => {
        renderTab();
        await user.click(screen.getByTestId("online-booking-slug-create"));
        await user.click(screen.getByTestId("online-booking-slug-save"));
        fetchSettings.mockResolvedValue(makeSettings({
            bookingSlug: "test-user",
            readiness: { ...READY, hasBookableType: false },
        }));
        await user.click(screen.getByTestId("availability-add-1"));
        await settle();
        const readiness = screen.getByTestId("online-booking-readiness");
        expect(within(readiness).getAllByText("(listo)")).toHaveLength(4);
    });

    it("says so when readiness can't be refreshed after saving availability", async () => {
        fetchSettings.mockResolvedValue(undefined);
        renderTab();
        await user.click(screen.getByTestId("availability-add-1"));
        await settle();
        expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("tells the provider that changes save automatically", () => {
        renderTab();
        expect(screen.getByTestId("online-booking-autosave-hint")).toHaveTextContent(/se guardan automáticamente/);
        expect(screen.queryByRole("button", { name: /Guardar/ })).not.toBeInTheDocument();
    });
});

describe("OnlineBookingTab: link", () => {
    it("creates the link from the prefilled suggestion in a modal", async () => {
        renderTab();
        expect(screen.queryByTestId("online-booking-slug-input")).not.toBeInTheDocument();
        await user.click(screen.getByTestId("online-booking-slug-create"));
        const input = screen.getByTestId("online-booking-slug-input");
        expect(input).toHaveValue("test-user");
        expect(input).toHaveFocus();
        await user.click(screen.getByTestId("online-booking-slug-save"));
        await settle(0);
        expect(updateSettings).toHaveBeenCalledWith({ bookingSlug: "test-user" });
        expect(screen.queryByTestId("online-booking-slug-modal")).not.toBeInTheDocument();
        expect(screen.getByTestId("online-booking-slug-save-state")).toHaveTextContent("Guardado");
    });

    it("submits with Enter", async () => {
        renderTab();
        await user.click(screen.getByTestId("online-booking-slug-create"));
        await user.keyboard("{Enter}");
        expect(updateSettings).toHaveBeenCalledWith({ bookingSlug: "test-user" });
    });

    it("validates the slug before saving", async () => {
        renderTab();
        await user.click(screen.getByTestId("online-booking-slug-create"));
        const input = screen.getByTestId("online-booking-slug-input");
        await user.clear(input);
        await user.type(input, "dra maría");
        expect(screen.getByRole("alert")).toHaveTextContent(/letras minúsculas/);
        expect(screen.getByTestId("online-booking-slug-save")).toBeDisabled();
    });

    it("never autosaves the slug while typing", async () => {
        settings = makeSettings(WITH_LINK);
        renderTab();
        await user.click(screen.getByTestId("online-booking-slug-edit"));
        const input = screen.getByTestId("online-booking-slug-input");
        await user.clear(input);
        await user.type(input, "dra-nueva");
        await settle(5000);
        expect(updateSettings).not.toHaveBeenCalled();
    });

    it("warns that renaming breaks shared links, and saves the rename", async () => {
        settings = makeSettings(WITH_LINK);
        renderTab();
        await user.click(screen.getByTestId("online-booking-slug-edit"));
        expect(screen.queryByTestId("online-booking-slug-warning")).not.toBeInTheDocument();
        expect(screen.getByTestId("online-booking-slug-save")).toBeDisabled();
        const input = screen.getByTestId("online-booking-slug-input");
        await user.clear(input);
        await user.type(input, "dra-nueva");
        expect(screen.getByTestId("online-booking-slug-warning")).toHaveTextContent(/dejarán de funcionar/);
        await user.click(screen.getByTestId("online-booking-slug-save"));
        expect(updateSettings).toHaveBeenCalledWith({ bookingSlug: "dra-nueva" });
    });

    it("warns that clearing the slug disables booking and asks to remove it explicitly", async () => {
        settings = makeSettings(WITH_LINK);
        renderTab();
        await user.click(screen.getByTestId("online-booking-slug-edit"));
        await user.clear(screen.getByTestId("online-booking-slug-input"));
        expect(screen.getByTestId("online-booking-slug-clear-warning")).toHaveTextContent(/se desactivará/);
        expect(screen.queryByTestId("online-booking-slug-warning")).not.toBeInTheDocument();
        const remove = screen.getByTestId("online-booking-slug-save");
        expect(remove).toHaveTextContent("Quitar enlace");
        await user.click(remove);
        expect(updateSettings).toHaveBeenCalledWith({ bookingSlug: null });
    });

    it("discards the edit on Escape", async () => {
        settings = makeSettings(WITH_LINK);
        renderTab();
        await user.click(screen.getByTestId("online-booking-slug-edit"));
        await user.type(screen.getByTestId("online-booking-slug-input"), "-x");
        await user.keyboard("{Escape}");
        expect(screen.queryByTestId("online-booking-slug-modal")).not.toBeInTheDocument();
        expect(updateSettings).not.toHaveBeenCalled();
    });

    it("keeps the modal open with the server error when the link is taken", async () => {
        updateSettings.mockRejectedValue(new Error("Ese enlace ya está en uso."));
        renderTab();
        await user.click(screen.getByTestId("online-booking-slug-create"));
        await user.click(screen.getByTestId("online-booking-slug-save"));
        await settle(0);
        const modal = screen.getByTestId("online-booking-slug-modal");
        expect(within(modal).getByRole("alert")).toHaveTextContent("Ese enlace ya está en uso.");
        expect(screen.getByTestId("online-booking-slug-save")).toBeEnabled();
    });

    it("shows the URL, QR and copies the link", async () => {
        const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
        settings = makeSettings(WITH_LINK);
        renderTab();
        const link = screen.getByRole("link", { name: "https://app.test/book/dra" });
        expect(link).toHaveAttribute("href", "https://app.test/book/dra");
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
        expect(within(screen.getByTestId("online-booking-qr")).getByTitle(/Código QR/)).toBeInTheDocument();
        await user.click(screen.getByTestId("online-booking-copy"));
        await settle(0);
        expect(writeText).toHaveBeenCalledWith("https://app.test/book/dra");
        expect(screen.getByText("¡Copiado!")).toBeInTheDocument();
    });
});

describe("OnlineBookingTab: availability", () => {
    it("adds a default window and autosaves the whole week after the debounce", async () => {
        renderTab();
        expect(within(screen.getByTestId("availability-day-1")).getByText("No disponible")).toBeInTheDocument();
        await user.click(screen.getByTestId("availability-add-1"));
        expect(screen.getByTestId("availability-start-1-0")).toHaveValue("09:00");
        expect(screen.getByTestId("availability-end-1-0")).toHaveValue("12:00");
        expect(saveAvailability).not.toHaveBeenCalled();
        await settle();
        expect(saveAvailability).toHaveBeenCalledWith([ { weekday: 1, startMinute: 540, endMinute: 720 } ]);
        expect(fetchSettings).toHaveBeenCalled();
        expect(screen.getByTestId("availability-save-state")).toHaveTextContent("Guardado");
    });

    it("coalesces quick edits into one save", async () => {
        renderTab();
        await user.click(screen.getByTestId("availability-add-1"));
        await user.click(screen.getByTestId("availability-add-2"));
        await settle();
        expect(saveAvailability).toHaveBeenCalledTimes(1);
        expect(saveAvailability).toHaveBeenCalledWith([
            { weekday: 1, startMinute: 540, endMinute: 720 },
            { weekday: 2, startMinute: 540, endMinute: 720 },
        ]);
    });

    it("does not save overlapping windows", async () => {
        rules = [ { weekday: 2, startMinute: 540, endMinute: 720 } ];
        renderTab();
        await user.click(screen.getByTestId("availability-add-2"));
        fireEvent.change(screen.getByTestId("availability-start-2-1"), { target: { value: "10:00" } });
        await settle();
        expect(screen.getByRole("alert")).toHaveTextContent(/superponen el martes/);
        expect(screen.getByTestId("availability-unsaved")).toBeInTheDocument();
        expect(saveAvailability).not.toHaveBeenCalled();
    });

    it("saves once the overlap is fixed", async () => {
        rules = [ { weekday: 2, startMinute: 540, endMinute: 720 } ];
        renderTab();
        await user.click(screen.getByTestId("availability-add-2"));
        fireEvent.change(screen.getByTestId("availability-start-2-1"), { target: { value: "10:00" } });
        fireEvent.change(screen.getByTestId("availability-start-2-1"), { target: { value: "13:00" } });
        await settle();
        expect(saveAvailability).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId("availability-unsaved")).not.toBeInTheDocument();
    });

    it("adds a non-overlapping window late in the day", async () => {
        rules = [ { weekday: 3, startMinute: 1200, endMinute: 1410 } ];
        renderTab();
        await user.click(screen.getByTestId("availability-add-3"));
        expect(screen.getByTestId("availability-start-3-1")).toHaveValue("23:30");
        expect(screen.getByTestId("availability-end-3-1")).toHaveValue("00:00");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByTestId("availability-add-3")).toBeDisabled();
    });

    it("shows overlap errors on the offending day only", async () => {
        rules = [ { weekday: 2, startMinute: 540, endMinute: 720 } ];
        renderTab();
        await user.click(screen.getByTestId("availability-add-2"));
        fireEvent.change(screen.getByTestId("availability-start-2-1"), { target: { value: "10:00" } });
        expect(within(screen.getByTestId("availability-day-2")).getByRole("alert")).toHaveTextContent(/superponen/);
        expect(screen.getByTestId("availability-start-2-1")).toHaveAttribute("aria-invalid", "true");
    });

    it("copies a day's windows to the rest of the workweek, replacing them", async () => {
        rules = [
            { weekday: 1, startMinute: 540, endMinute: 720 },
            { weekday: 3, startMinute: 600, endMinute: 660 },
            { weekday: 6, startMinute: 600, endMinute: 660 },
        ];
        renderTab();
        await user.click(screen.getByTestId("availability-copy-1"));
        await settle();
        expect(saveAvailability).toHaveBeenCalledWith([ 1, 2, 3, 4, 5 ].map((weekday) => ({ weekday, startMinute: 540, endMinute: 720 }))
            .concat({ weekday: 6, startMinute: 600, endMinute: 660 }));
    });

    it("labels a midnight end as end of day", async () => {
        rules = [ { weekday: 4, startMinute: 1200, endMinute: 1440 } ];
        renderTab();
        expect(within(screen.getByTestId("availability-day-4")).getByText("fin del día")).toBeInTheDocument();
    });

    it("removes a window", async () => {
        rules = [ { weekday: 5, startMinute: 600, endMinute: 660 } ];
        renderTab();
        await user.click(screen.getByTestId("availability-remove-5-0"));
        await settle();
        expect(saveAvailability).toHaveBeenCalledWith([]);
    });

    it("shows the server error when saving fails", async () => {
        saveAvailability.mockRejectedValue(new Error("No pudimos guardar la disponibilidad."));
        renderTab();
        await user.click(screen.getByTestId("availability-add-1"));
        await settle();
        expect(screen.getByRole("alert")).toHaveTextContent("No pudimos guardar la disponibilidad.");
    });
});

describe("OnlineBookingTab: rules", () => {
    const type = (defaultDuration: number, bookableOnline = true): AppointmentType =>
        ({ id: `t${defaultDuration}`, name: `Cita ${defaultDuration}`, defaultDuration, bookableOnline });

    it("warns when the interval lets online bookings leave gaps, ignoring types not bookable online", async () => {
        appointmentTypes = [ type(60), type(45, false) ];
        renderTab();
        expect(screen.getByTestId("online-booking-interval-warning")).toHaveTextContent("duran 60 min");
        expect(screen.getByTestId("online-booking-interval-warning")).toHaveTextContent("usa 60 min");
        await user.click(within(screen.getByTestId("online-booking-interval")).getByRole("combobox"));
        await user.click(screen.getByRole("option", { name: "60 min" }));
        expect(screen.queryByTestId("online-booking-interval-warning")).not.toBeInTheDocument();
    });

    it("shows no interval warning without bookable types", () => {
        appointmentTypes = [ type(60, false) ];
        renderTab();
        expect(screen.queryByTestId("online-booking-interval-warning")).not.toBeInTheDocument();
    });

    it("autosaves buffer, lead time (hours → minutes) and horizon in one request", async () => {
        renderTab();
        const buffer = screen.getByTestId("online-booking-buffer");
        await user.clear(buffer);
        await user.type(buffer, "15");
        const lead = screen.getByTestId("online-booking-lead");
        await user.clear(lead);
        await user.type(lead, "24");
        expect(updateSettings).not.toHaveBeenCalled();
        await settle();
        expect(updateSettings).toHaveBeenCalledTimes(1);
        expect(updateSettings).toHaveBeenCalledWith({
            slotIntervalMinutes: 30, bufferMinutes: 15, minLeadMinutes: 1440, maxHorizonDays: 60,
            maxPatientReschedules: 2, minRescheduleNoticeHours: 0,
            portalReminderTiming: "ONE_DAY_BEFORE",
        });
        expect(screen.getByTestId("online-booking-rules-save-state")).toHaveTextContent("Guardado");
    });

    it("saves the patient reschedule policy, 0 meaning no online reschedules", async () => {
        renderTab();
        const reschedules = screen.getByTestId("online-booking-max-reschedules");
        await user.clear(reschedules);
        await user.type(reschedules, "0");
        const notice = screen.getByTestId("online-booking-reschedule-notice");
        await user.clear(notice);
        await user.type(notice, "24");
        await settle();
        expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ maxPatientReschedules: 0, minRescheduleNoticeHours: 24 }));
    });

    it("offers the appointment modal's reminder presets and saves the chosen one", async () => {
        renderTab();
        const field = screen.getByTestId("online-booking-reminder-timing");
        expect(field).toHaveTextContent("Se envía 1 día antes de la cita");
        await user.click(within(field).getByRole("combobox"));
        expect(within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent)).toEqual([
            "Ninguno", "1 hora antes", "1 día antes", "Mañana del día de la cita", "Mañana del día anterior", "Tarde del día anterior",
        ]);
        await user.click(screen.getByRole("option", { name: "Tarde del día anterior" }));
        expect(field).toHaveTextContent("la tarde del día anterior (18:00, hora del paciente)");
        await settle();
        expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ portalReminderTiming: "PREVIOUS_DAY_EVENING" }));
    });

    it("turns the portal reminder off with Ninguno", async () => {
        renderTab();
        const field = screen.getByTestId("online-booking-reminder-timing");
        await user.click(within(field).getByRole("combobox"));
        await user.click(screen.getByRole("option", { name: "Ninguno" }));
        expect(field).toHaveTextContent("no reciben recordatorio automático");
        await settle();
        expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ portalReminderTiming: "NONE" }));
    });

    it("does not save an out-of-range reschedule policy", async () => {
        renderTab();
        const reschedules = screen.getByTestId("online-booking-max-reschedules");
        await user.clear(reschedules);
        await user.type(reschedules, "11");
        await settle();
        expect(updateSettings).not.toHaveBeenCalled();
        expect(screen.getByRole("alert")).toHaveTextContent(/entre 0 y 10/);
        expect(screen.getByTestId("online-booking-rules-unsaved")).toBeInTheDocument();
        await user.clear(reschedules);
        await user.type(reschedules, "1");
        const notice = screen.getByTestId("online-booking-reschedule-notice");
        await user.clear(notice);
        await user.type(notice, "1.5");
        await settle();
        expect(updateSettings).not.toHaveBeenCalled();
    });

    it("does not save out-of-range values", async () => {
        renderTab();
        const horizon = screen.getByTestId("online-booking-horizon");
        await user.clear(horizon);
        await user.type(horizon, "400");
        await settle();
        expect(updateSettings).not.toHaveBeenCalled();
        expect(horizon).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByRole("alert")).toHaveTextContent(/entre 1 y 365/);
    });

    it("waits for a lead time that reaches the horizon to be fixed", async () => {
        renderTab();
        const lead = screen.getByTestId("online-booking-lead");
        await user.clear(lead);
        await user.type(lead, "48");
        const horizon = screen.getByTestId("online-booking-horizon");
        await user.clear(horizon);
        await user.type(horizon, "2");
        expect(horizon).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByRole("alert")).toHaveTextContent(/anticipación mínima/);
        await user.clear(horizon);
        await user.type(horizon, "3");
        await settle();
        expect(updateSettings).toHaveBeenCalledTimes(1);
        expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ minLeadMinutes: 2880, maxHorizonDays: 3 }));
    });

    it("keeps a cleared field empty and invalid instead of turning it into 0", async () => {
        renderTab();
        const buffer = screen.getByTestId("online-booking-buffer");
        await user.type(buffer, "5");
        await user.clear(buffer);
        await settle();
        expect(buffer).toHaveValue(null);
        expect(updateSettings).not.toHaveBeenCalled();
    });

    it("saves nothing when a value is changed back before the debounce", async () => {
        renderTab();
        const buffer = screen.getByTestId("online-booking-buffer");
        await user.clear(buffer);
        await user.type(buffer, "5");
        await user.clear(buffer);
        await user.type(buffer, "0");
        await settle();
        expect(updateSettings).not.toHaveBeenCalled();
    });

    it("saves a pending change when the tab is left before the debounce", async () => {
        const { unmount } = renderTab();
        const buffer = screen.getByTestId("online-booking-buffer");
        await user.clear(buffer);
        await user.type(buffer, "10");
        unmount();
        await settle(0);
        expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ bufferMinutes: 10 }));
    });
});

describe("OnlineBookingTab: status summary", () => {
    it("says plainly when the link is live and hides the checklist", () => {
        settings = makeSettings({ bookingEnabled: true, live: true, ...WITH_LINK, readiness: READY });
        renderTab();
        expect(screen.getByTestId("online-booking-status")).toHaveTextContent("Tu enlace está recibiendo reservas.");
        expect(screen.queryByTestId("online-booking-readiness")).not.toBeInTheDocument();
    });

    it("links pending items to where they are fixed", () => {
        settings = makeSettings({ readiness: { ...READY, hasBookableType: false } });
        renderTab();
        expect(screen.getByRole("link", { name: "Ir a Tipos de Cita" })).toHaveAttribute("href", "/settings?tab=Tipos+de+Cita");
        expect(screen.queryByRole("link", { name: "Ir a Ubicaciones" })).not.toBeInTheDocument();
    });

    it("shows the full domain as the slug prefix once a link exists", async () => {
        settings = makeSettings(WITH_LINK);
        renderTab();
        await user.click(screen.getByTestId("online-booking-slug-edit"));
        expect(screen.getByText("https://app.test/book/")).toBeInTheDocument();
    });
});

describe("OnlineBookingTab: public profile", () => {
    it("loads the stored profile and autosaves changes, trimmed, with blanks as null", async () => {
        settings = makeSettings({ specialty: "Psicología", publicPhone: "+573001112222" });
        renderTab();
        expect(screen.getByTestId("online-booking-specialty")).toHaveValue("Psicología");

        await user.type(screen.getByTestId("online-booking-bio"), "  Atiendo adultos  ");
        expect(updateSettings).not.toHaveBeenCalled();
        await settle();

        expect(updateSettings).toHaveBeenCalledWith({
            specialty: "Psicología", bio: "Atiendo adultos", publicPhone: "+573001112222", publicWhatsapp: null,
            legalName: null, privacyContact: null, contactHours: null,
        });
        expect(screen.getByTestId("online-booking-profile-save-state")).toHaveTextContent("Guardado");
    });

    it("shows a stored phone split into its country code and number", () => {
        settings = makeSettings({ publicPhone: "+525512345678" });
        renderTab();
        const phone = within(screen.getByTestId("online-booking-public-phone"));
        expect(phone.getByRole("combobox")).toHaveValue("mx");
        expect(phone.getByRole("textbox")).toHaveValue("5512345678");
    });

    it("saves the number with the selected country code", async () => {
        renderTab();
        const whatsapp = within(screen.getByTestId("online-booking-public-whatsapp"));
        await user.type(whatsapp.getByRole("textbox"), "300 111 2222");
        await settle();
        expect(updateSettings).toHaveBeenLastCalledWith(expect.objectContaining({ publicWhatsapp: "+573001112222" }));

        await user.selectOptions(whatsapp.getByRole("combobox"), "mx");
        await settle();
        expect(updateSettings).toHaveBeenLastCalledWith(expect.objectContaining({ publicWhatsapp: "+523001112222" }));
    });

    it("never saves an incomplete phone", async () => {
        renderTab();
        const phone = within(screen.getByTestId("online-booking-public-phone")).getByRole("textbox");
        await user.type(phone, "300");
        await settle();
        expect(updateSettings).not.toHaveBeenCalled();
        expect(phone).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByRole("alert")).toHaveTextContent(/incompleto/);
    });

    it("warns that the profile is public", () => {
        renderTab();
        expect(screen.getByTestId("online-booking-profile")).toHaveTextContent(/visible para cualquier persona/);
    });
});

describe("OnlineBookingTab: approval mode", () => {
    it("autosaves the review mode after a change", async () => {
        renderTab();
        await user.click(screen.getByTestId("online-booking-approval-require-approval"));
        expect(updateSettings).not.toHaveBeenCalled();
        await settle();
        expect(updateSettings).toHaveBeenCalledWith({ bookingApprovalMode: "REQUIRE_APPROVAL" });
        expect(screen.getByTestId("online-booking-approval-save-state")).toHaveTextContent("Guardado");
    });

    it("saves nothing when switched back before the debounce", async () => {
        renderTab();
        await user.click(screen.getByTestId("online-booking-approval-require-approval"));
        await user.click(screen.getByTestId("online-booking-approval-auto-confirm"));
        await settle();
        expect(updateSettings).not.toHaveBeenCalled();
    });

    it("explains that pending requests survive a switch back to auto-confirm", () => {
        settings = makeSettings({ bookingApprovalMode: "REQUIRE_APPROVAL" });
        renderTab();
        expect(screen.getByTestId("online-booking-approval-require-approval")).toBeChecked();
        expect(screen.getByText(/las solicitudes pendientes siguen esperando tu respuesta/)).toBeInTheDocument();
    });
});
