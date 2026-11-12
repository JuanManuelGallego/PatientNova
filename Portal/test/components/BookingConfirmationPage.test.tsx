import { StrictMode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const downloadMock = vi.hoisted(() => vi.fn());
vi.mock("@/src/utils/appointmentCalendar", () => ({ downloadAppointmentIcs: downloadMock }));

import { BookingConfirmationPage } from "@/src/components/PublicBooking/BookingConfirmationPage";

const TOKEN = "tok-secret-123";
const view = (overrides: Record<string, unknown> = {}) => ({
    state: "unconfirmed",
    providerSlug: "dra-ana",
    providerName: "Dra. Ana Pública",
    startUtc: "2099-03-10T15:00:00.000Z",
    durationMinutes: 45,
    patientTimezone: "America/Bogota",
    typeName: "Consulta",
    location: { name: "Consultorio Centro", address: "Calle 1 # 2-3", isVirtual: false },
    holdExpiresAt: "2099-03-10T10:00:00.000Z",
    approvalRequired: false,
    providerContact: { phone: "+573001112222", whatsapp: null },
    ...overrides,
});
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
const fail = (status: number, error: string) => new Response(JSON.stringify({ success: false, error }), { status });

const fetchMock = vi.fn();
const calls = (suffix: string) => fetchMock.mock.calls.filter(([ url ]) => String(url).endsWith(suffix));

let handlers: { view: () => Response; confirm: () => Response };
beforeEach(() => {
    downloadMock.mockReset();
    handlers = { view: () => ok(view()), confirm: () => ok(view({ state: "confirmed" })) };
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
        if (String(url).endsWith("/booking-confirmations/view")) return handlers.view();
        if (String(url).endsWith("/booking-confirmations/confirm")) return handlers.confirm();
        throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("BookingConfirmationPage", () => {
    it("loads the view with a POST carrying the token in the body and does not confirm on load", async () => {
        render(<BookingConfirmationPage token={TOKEN} />);
        await screen.findByRole("button", { name: "Confirmar mi cita" });
        expect(calls("/booking-confirmations/view")).toHaveLength(1);
        expect(calls("/booking-confirmations/confirm")).toHaveLength(0);
        const [ url, init ] = calls("/booking-confirmations/view")[ 0 ];
        expect(String(url)).not.toContain(TOKEN);
        expect(init.method).toBe("POST");
        expect(JSON.parse(String(init.body))).toEqual({ token: TOKEN });
    });

    it("loads under StrictMode, whose doubled effect must not turn into the error state", async () => {
        render(<StrictMode><BookingConfirmationPage token={TOKEN} /></StrictMode>);
        expect(await screen.findByRole("button", { name: "Confirmar mi cita" })).toBeInTheDocument();
        expect(screen.queryByText(/No pudimos cargar tu cita/)).not.toBeInTheDocument();
        expect(calls("/booking-confirmations/confirm")).toHaveLength(0);
    });

    it("unconfirmed: shows provider, time in the patient zone, place and the confirm button", async () => {
        render(<BookingConfirmationPage token={TOKEN} />);
        expect(await screen.findByText(/Dra\. Ana Pública/)).toBeInTheDocument();
        expect(screen.getByTestId("confirmation-time")).toHaveTextContent(/10:00/);
        expect(screen.getByText("Consultorio Centro, Calle 1 # 2-3")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Confirmar mi cita" })).toBeEnabled();
    });

    it("a virtual place shows only its name", async () => {
        handlers.view = () => ok(view({ location: { name: "Videollamada", address: null, isVirtual: true } }));
        render(<BookingConfirmationPage token={TOKEN} />);
        expect(await screen.findByText("Videollamada")).toBeInTheDocument();
    });

    it("the button POSTs /confirm once, is disabled while busy, and shows the confirmed copy with .ics and contact", async () => {
        let release!: () => void;
        const gate = new Promise<void>((r) => { release = r; });
        fetchMock.mockImplementation(async (url: string) => {
            if (String(url).endsWith("/view")) return ok(view());
            await gate;
            return ok(view({ state: "confirmed" }));
        });
        const user = userEvent.setup();
        render(<BookingConfirmationPage token={TOKEN} />);
        const button = await screen.findByRole("button", { name: "Confirmar mi cita" });
        await user.click(button);
        expect(button).toBeDisabled();
        await user.click(button);
        release();
        expect(await screen.findByRole("heading", { name: "Tu cita está confirmada" })).toBeInTheDocument();
        expect(calls("/booking-confirmations/confirm")).toHaveLength(1);
        expect(JSON.parse(String(calls("/booking-confirmations/confirm")[ 0 ][ 1 ].body))).toEqual({ token: TOKEN });
        await user.click(screen.getByRole("button", { name: "Agregar al calendario" }));
        expect(downloadMock).toHaveBeenCalledWith(expect.objectContaining({ startUtc: "2099-03-10T15:00:00.000Z" }), "Dra. Ana Pública", "America/Bogota");
        expect(screen.getByTestId("provider-contact")).toBeInTheDocument();
    });

    it("the calendar entry ends at start + durationMinutes", async () => {
        handlers.view = () => ok(view({ state: "confirmed" }));
        const user = userEvent.setup();
        render(<BookingConfirmationPage token={TOKEN} />);
        await user.click(await screen.findByRole("button", { name: "Agregar al calendario" }));
        const entry = downloadMock.mock.calls[ 0 ][ 0 ];
        expect(entry.endUtc).toBe("2099-03-10T15:45:00.000Z");
        expect(entry.durationMinutes).toBe(45);
    });

    it("a server failure on confirm shows an inline error that a retry clears", async () => {
        let attempts = 0;
        handlers.confirm = () => (++attempts === 1 ? fail(500, "boom") : ok(view({ state: "confirmed" })));
        const user = userEvent.setup();
        render(<BookingConfirmationPage token={TOKEN} />);
        await user.click(await screen.findByRole("button", { name: "Confirmar mi cita" }));
        expect(await screen.findByRole("alert")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Confirmar mi cita" }));
        expect(await screen.findByRole("heading", { name: "Tu cita está confirmada" })).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("a second visit to a confirmed link shows the confirmed view", async () => {
        handlers.view = () => ok(view({ state: "confirmed" }));
        render(<BookingConfirmationPage token={TOKEN} />);
        expect(await screen.findByRole("heading", { name: "Tu cita está confirmada" })).toBeInTheDocument();
    });

    it("requested: says the provider will answer", async () => {
        handlers.view = () => ok(view({ state: "requested", approvalRequired: true }));
        render(<BookingConfirmationPage token={TOKEN} />);
        expect(await screen.findByText("Solicitud enviada. Dra. Ana Pública te avisará cuando la confirme.")).toBeInTheDocument();
        expect(screen.getByTestId("provider-contact")).toBeInTheDocument();
    });

    it("expired: says the time was released and links to /book/{slug}", async () => {
        handlers.view = () => ok(view({ state: "expired" }));
        render(<BookingConfirmationPage token={TOKEN} />);
        expect(await screen.findByText("Este enlace venció y el horario quedó libre.")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Reservar de nuevo" })).toHaveAttribute("href", "/book/dra-ana");
        expect(screen.getByTestId("provider-contact")).toBeInTheDocument();
    });

    it("expired without a provider slug builds no link", async () => {
        handlers.view = () => ok(view({ state: "expired", providerSlug: "" }));
        render(<BookingConfirmationPage token={TOKEN} />);
        await screen.findByText("Este enlace venció y el horario quedó libre.");
        expect(screen.queryByRole("link", { name: "Reservar de nuevo" })).not.toBeInTheDocument();
    });

    it("unavailable: tells the patient to contact the provider directly", async () => {
        handlers.view = () => ok(view({ state: "unavailable" }));
        render(<BookingConfirmationPage token={TOKEN} />);
        expect(await screen.findByText("No pudimos confirmar tu cita en línea. Comunícate directamente con Dra. Ana Pública.")).toBeInTheDocument();
        expect(screen.getByTestId("provider-contact")).toBeInTheDocument();
    });

    it("a refused confirm (409) shows the unavailable copy", async () => {
        handlers.confirm = () => fail(409, "conflict");
        const user = userEvent.setup();
        render(<BookingConfirmationPage token={TOKEN} />);
        await user.click(await screen.findByRole("button", { name: "Confirmar mi cita" }));
        expect(await screen.findByText(/No pudimos confirmar tu cita en línea/)).toBeInTheDocument();
        expect(screen.getByTestId("provider-contact")).toBeInTheDocument();
    });

    it("a 404 on the view shows the shared unavailable page", async () => {
        handlers.view = () => fail(404, "not found");
        render(<BookingConfirmationPage token={TOKEN} />);
        expect(await screen.findByRole("heading", { name: "Esta página de reservas no está disponible" })).toBeInTheDocument();
    });

    it("a 404 on confirm after the view loaded is a refusal: the unavailable copy with the provider contact", async () => {
        handlers.confirm = () => fail(404, "Provider not found");
        const user = userEvent.setup();
        render(<BookingConfirmationPage token={TOKEN} />);
        await user.click(await screen.findByRole("button", { name: "Confirmar mi cita" }));
        expect(await screen.findByText("No pudimos confirmar tu cita en línea. Comunícate directamente con Dra. Ana Pública.")).toBeInTheDocument();
        expect(screen.getByTestId("provider-contact")).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Esta página de reservas no está disponible" })).not.toBeInTheDocument();
    });

    it("a server failure on the view offers a retry", async () => {
        handlers.view = () => fail(500, "boom");
        render(<BookingConfirmationPage token={TOKEN} />);
        await waitFor(() => expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument());
    });
});
