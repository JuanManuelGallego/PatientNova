import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/utils/TimeUtils", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/src/utils/TimeUtils")>(),
    browserTimezone: () => "Europe/Madrid",
}));

import { PortalAppointmentsPage } from "@/src/components/PublicBooking/PortalAppointmentsPage";
import { csrfStore } from "@/src/api/base/csrfStore";
import { todayFormattedString } from "@/src/utils/TimeUtils";

const SLUG = "dra-ana";
const provider = {
    displayName: "Dra. Ana Pública",
    jobTitle: "Psicóloga",
    hasAvatar: false,
    hasLogo: false,
    timezone: "America/Bogota",
    bookingOpen: true,
    approvalRequired: false,
    selfServe: true,
    whatsappConfirmation: true,
    lastBookableDate: "2099-12-31",
    types: [],
    locations: [],
};
const session = (overrides: Record<string, unknown> = {}) => ({
    contact: "ana@example.com",
    contactChannel: "EMAIL",
    expiresAt: "2099-01-01T02:00:00.000Z",
    csrfToken: "csrf-from-session",
    providerSlug: SLUG,
    consentRequired: false,
    bookingOpen: true,
    ...overrides,
});

const ok = (status: number, data?: unknown) =>
    status === 204 ? new Response(null, { status }) : new Response(JSON.stringify({ success: true, data }), { status });
const fail = (status: number, error: string) => new Response(JSON.stringify({ success: false, error }), { status });

interface Server {
    profileStatus: number;
    profile: typeof provider;
    session: ReturnType<typeof session> | null;
    logoutFails?: boolean;
    appointments: () => Response;
    slots: () => Response;
    cancel: (id: string) => Response;
    cancelRequest: (id: string) => Response;
    reschedule: (id: string, body: unknown) => Response;
}
let server: Server;
const fetchMock = vi.fn();

function call(path: string) {
    return fetchMock.mock.calls.filter(([ url ]) => String(url).endsWith(path));
}

beforeEach(() => {
    csrfStore.clear();
    server = {
        profileStatus: 200,
        profile: provider,
        session: null,
        appointments: () => ok(200, { appointments: [], consentRequired: true }),
        slots: () => ok(200, { timezone: "America/Bogota", slots: [] }),
        cancel: () => ok(204),
        cancelRequest: () => ok(204),
        reschedule: () => fail(500, "unexpected"),
    };
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string, init: RequestInit = {}) => {
        const path = url.replace(/^.*\/v1/, "").toLowerCase();
        if (path === `/public/providers/${SLUG}`) {
            return server.profileStatus === 200 ? ok(200, server.profile) : fail(server.profileStatus, "Provider not found");
        }
        if (path === "/portal/session") return server.session ? ok(200, server.session) : fail(401, "Invalid session");
        if (path === "/portal/consent") return ok(204);
        if (path === "/portal/appointments") return server.appointments();
        if (path.startsWith(`/public/providers/${SLUG}/slots?`)) throw new Error("reschedule must not use the public slots");
        if (/^\/portal\/appointments\/[^/]+\/slots\?/.test(path)) return server.slots();
        const requestCancel = path.match(/^\/portal\/requests\/([^/]+)\/cancel$/);
        if (requestCancel) return server.cancelRequest(requestCancel[ 1 ]);
        const action = path.match(/^\/portal\/appointments\/([^/]+)\/(cancel|reschedule)$/);
        if (action) {
            return action[ 2 ] === "cancel" ? server.cancel(action[ 1 ]) : server.reschedule(action[ 1 ], JSON.parse(String(init.body)));
        }
        if (path === "/portal/logout") {
            if (server.logoutFails) return fail(503, "unavailable");
            server.session = null;
            return ok(204);
        }
        throw new Error(`unexpected ${init.method ?? "GET"} ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("PortalAppointmentsPage", () => {
    it("shows the unavailable page without a session, whatever the flag says", async () => {
        render(<PortalAppointmentsPage slug={SLUG} />);
        expect(await screen.findByRole("heading", { name: "Esta página de reservas no está disponible" })).toBeInTheDocument();
        expect(screen.queryByLabelText("Correo electrónico")).not.toBeInTheDocument();
    });

    it("shows the unavailable page when provider.selfServe is false, even with a session, and asks for no session", async () => {
        server.profile = { ...provider, selfServe: false };
        server.session = session();
        render(<PortalAppointmentsPage slug={SLUG} />);
        expect(await screen.findByRole("heading", { name: "Esta página de reservas no está disponible" })).toBeInTheDocument();
        expect(screen.queryByText("No tienes citas próximas.")).not.toBeInTheDocument();
        expect(call("/portal/session")).toHaveLength(0);
    });

    it("shows the unavailable page when the session belongs to another provider", async () => {
        server.session = session({ providerSlug: "otro-profesional" });
        render(<PortalAppointmentsPage slug={SLUG} />);
        expect(await screen.findByRole("heading", { name: "Esta página de reservas no está disponible" })).toBeInTheDocument();
        expect(screen.queryByText("No tienes citas próximas.")).not.toBeInTheDocument();
    });

    it("resumes an existing session on reload and logs out back to the unavailable page", async () => {
        server.session = session();
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);

        expect(await screen.findByText("No tienes citas próximas.")).toBeInTheDocument();
        expect(screen.getByText("ana@example.com")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Reservar una cita" })).toHaveAttribute("href", `/book/${SLUG}`);
        expect(screen.getByRole("heading", { name: "Mis citas" })).toBeInTheDocument();
        expect(screen.getByText("Dra. Ana Pública")).toBeInTheDocument();
        expect(screen.getByText("AP")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));

        expect(await screen.findByRole("heading", { name: "Esta página de reservas no está disponible" })).toBeInTheDocument();
        expect((call("/portal/logout")[ 0 ][ 1 ].headers as Record<string, string>)[ "X-CSRF-Token" ]).toBe("csrf-from-session");
        expect(csrfStore.get()).toBeNull();
    });

    it("leaves the page when consent answers 401", async () => {
        server.session = session({ consentRequired: true });
        fetchMock.mockImplementation(async (url: string) => {
            const path = url.replace(/^.*\/v1/, "");
            if (path === `/public/providers/${SLUG}`) return ok(200, provider);
            if (path === "/portal/session") return ok(200, server.session);
            if (path === "/portal/appointments") return ok(200, { appointments: [], requests: [], consentRequired: true });
            return fail(401, "Invalid session");
        });
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        await user.click(await screen.findByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Continuar" }));
        expect(await screen.findByRole("heading", { name: "Esta página de reservas no está disponible" })).toBeInTheDocument();
    });

    it("shows the same unavailable page for an unknown provider, without a session call", async () => {
        server.profileStatus = 404;
        render(<PortalAppointmentsPage slug={SLUG} />);
        expect(await screen.findByRole("heading", { name: "Esta página de reservas no está disponible" })).toBeInTheDocument();
        await waitFor(() => expect(call("/portal/session")).toHaveLength(0));
    });

    it("matches the session to a mixed-case slug in the URL (the server stores it lowercased)", async () => {
        server.session = session();
        render(<PortalAppointmentsPage slug="Dra-Ana" />);
        expect(await screen.findByText("No tienes citas próximas.")).toBeInTheDocument();
    });

    it("keeps the session on screen when logout fails, and logs out on retry", async () => {
        server.session = session();
        server.logoutFails = true;
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);

        await user.click(await screen.findByRole("button", { name: "Cerrar sesión" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cerrar la sesión");
        expect(screen.getByText("No tienes citas próximas.")).toBeInTheDocument();
        expect(csrfStore.get()).toBe("csrf-from-session");

        server.logoutFails = false;
        await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));
        expect(await screen.findByRole("heading", { name: "Esta página de reservas no está disponible" })).toBeInTheDocument();
    });
});

describe("PortalAppointmentsPage upcoming appointments", () => {
    const appointment = (id: string, startUtc: string, endUtc: string) => ({
        id,
        startUtc,
        endUtc,
        durationMinutes: 60,
        status: "CONFIRMED",
        price: 150000,
        type: { name: "Primera consulta" },
        location: { name: "Consultorio Centro", address: "Calle 10", instructions: "Timbre 2", isVirtual: false },
        meeting: null,
    });

    it("lists the appointments in the device zone, across its DST change", async () => {
        server.session = session();
        server.appointments = () => ok(200, {
            consentRequired: false,
            appointments: [
                appointment("a1", "2099-01-20T15:00:00.000Z", "2099-01-20T16:00:00.000Z"),
                appointment("a2", "2099-07-20T15:00:00.000Z", "2099-07-20T16:00:00.000Z"),
            ],
        });
        render(<PortalAppointmentsPage slug={SLUG} />);

        const list = await screen.findByRole("list", { name: "Próximas citas" });
        const [ winter, summer ] = within(list).getAllByRole("article");
        expect(winter).toHaveTextContent(/20 de enero de 2099/);
        expect(winter).toHaveTextContent(/04:00 p\. m\. – 05:00 p\. m\./);
        expect(summer).toHaveTextContent(/05:00 p\. m\. – 06:00 p\. m\./);
        expect(winter).toHaveTextContent("Primera consulta · 60 minutos");
        expect(winter).toHaveTextContent("Consultorio Centro, Calle 10");
        expect(winter).toHaveTextContent("Timbre 2");
        expect(winter).toHaveTextContent("Confirmada");
        expect(screen.getByText(/Horas en tu zona horaria/)).toBeInTheDocument();
        expect(call("/portal/appointments")[ 0 ][ 1 ].credentials).toBe("include");
    });

    it("goes back to the login when the list answers 401", async () => {
        server.session = session();
        server.appointments = () => fail(401, "Invalid session");
        render(<PortalAppointmentsPage slug={SLUG} />);
        expect(await screen.findByRole("heading", { name: "Esta página de reservas no está disponible" })).toBeInTheDocument();
    });

    it("offers a retry when the list fails", async () => {
        server.session = session();
        server.appointments = () => fail(503, "unavailable");
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        expect(await screen.findByRole("alert")).toHaveTextContent(/error en el servidor/);

        server.appointments = () => ok(200, { consentRequired: false, appointments: [] });
        await user.click(screen.getByRole("button", { name: "Reintentar" }));
        expect(await screen.findByText("No tienes citas próximas.")).toBeInTheDocument();
    });
});

describe("PortalAppointmentsPage cancel and reschedule", () => {
    const madridToday = todayFormattedString("Europe/Madrid");
    const morning = `${madridToday}T09:00:00.000Z`;
    const afternoon = `${madridToday}T15:00:00.000Z`;
    const appt = (id: string, overrides: Record<string, unknown> = {}) => ({
        id,
        startUtc: "2099-01-20T15:00:00.000Z",
        endUtc: "2099-01-20T16:00:00.000Z",
        durationMinutes: 60,
        status: "CONFIRMED",
        price: 150000,
        type: { name: "Primera consulta" },
        location: { name: "Consultorio Centro", address: "Calle 10", instructions: null, isVirtual: false },
        meeting: null,
        canCancel: true,
        canReschedule: true,
        ...overrides,
    });
    let listed: ReturnType<typeof appt>[];
    const slotCalls = () => fetchMock.mock.calls.filter(([ url ]) => String(url).includes("/slots?"));

    beforeEach(() => {
        server.session = session();
        listed = [ appt("a1"), appt("a2", { startUtc: "2099-02-20T15:00:00.000Z", endUtc: "2099-02-20T16:00:00.000Z", canReschedule: false }) ];
        server.appointments = () => ok(200, { consentRequired: false, appointments: listed });
        server.slots = () => ok(200, {
            timezone: "America/Bogota",
            slots: [ morning, afternoon ].map((startUtc) => ({ startUtc, endUtc: startUtc })),
        });
    });

    const pending = (id: string, overrides: Record<string, unknown> = {}) => ({
        id,
        status: "PENDING",
        startUtc: "2099-02-21T15:00:00.000Z",
        endUtc: "2099-02-21T16:00:00.000Z",
        durationMinutes: 60,
        holdExpiresAt: "2099-02-19T15:00:00.000Z",
        type: { name: "Control" },
        location: { name: "Consultorio Centro", address: "Calle 10", isVirtual: false },
        ...overrides,
    });

    it("lists pending requests apart from appointments and cancels one after confirming", async () => {
        let requests = [ pending("r1") ];
        server.appointments = () => ok(200, { consentRequired: false, appointments: listed, requests });
        server.cancelRequest = (id) => {
            requests = requests.filter((r) => r.id !== id);
            return ok(204);
        };
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);

        const list = await screen.findByRole("list", { name: "Solicitudes pendientes" });
        const card = within(list).getByRole("article");
        expect(card).toHaveTextContent("Pendiente");
        expect(screen.getByRole("heading", { name: "Solicitudes pendientes" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Próximas citas" })).toBeInTheDocument();
        expect(card).toHaveTextContent("Control · 60 minutos");
        expect(within(card).queryByRole("button", { name: "Reprogramar" })).toBeNull();
        expect(within(await screen.findByRole("list", { name: "Próximas citas" })).getAllByRole("article")).toHaveLength(2);

        await user.click(within(card).getByRole("button", { name: "Cancelar solicitud" }));
        const dialog = await screen.findByRole("alertdialog", { name: "¿Cancelar esta solicitud?" });
        await user.click(within(dialog).getByRole("button", { name: "Sí, cancelar solicitud" }));

        expect(await screen.findByRole("status")).toHaveTextContent("Tu solicitud quedó cancelada y el horario se liberó.");
        await waitFor(() => expect(screen.queryByRole("list", { name: "Solicitudes pendientes" })).toBeNull());
        expect(call("/portal/requests/r1/cancel")).toHaveLength(1);
    });

    it("keeps pending requests visible and cancellable while consent is still asked for", async () => {
        server.session = session({ consentRequired: true });
        let requests = [ pending("r3") ];
        server.appointments = () => ok(200, { consentRequired: true, appointments: [], requests });
        server.cancelRequest = (id) => {
            requests = requests.filter((r) => r.id !== id);
            return ok(204);
        };
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);

        expect(await screen.findByRole("heading", { name: "Antes de continuar" })).toBeInTheDocument();
        const list = await screen.findByRole("list", { name: "Solicitudes pendientes" });
        expect(within(list).getByRole("article")).toHaveTextContent("Control · 60 minutos");

        await user.click(within(list).getByRole("button", { name: "Cancelar solicitud" }));
        await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Sí, cancelar solicitud" }));

        expect(await screen.findByRole("status")).toHaveTextContent("Tu solicitud quedó cancelada y el horario se liberó.");
        await waitFor(() => expect(screen.queryByRole("list", { name: "Solicitudes pendientes" })).toBeNull());
        expect(screen.getByRole("heading", { name: "Antes de continuar" })).toBeInTheDocument();
        expect(call("/portal/requests/r3/cancel")).toHaveLength(1);
    });

    it("shows no request section under the consent prompt when there are none", async () => {
        server.session = session({ consentRequired: true });
        server.appointments = () => ok(200, { consentRequired: true, appointments: [], requests: [] });
        render(<PortalAppointmentsPage slug={SLUG} />);

        expect(await screen.findByRole("heading", { name: "Antes de continuar" })).toBeInTheDocument();
        await waitFor(() => expect(call("/portal/appointments")).toHaveLength(1));
        expect(screen.queryByRole("heading", { name: "Solicitudes pendientes" })).toBeNull();
    });

    it("shows only requests when there are no appointments, and closes the action with the server message on 404", async () => {
        server.appointments = () => ok(200, { consentRequired: false, appointments: [], requests: [ pending("r2") ] });
        server.cancelRequest = () => fail(404, "Request not found");
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);

        const list = await screen.findByRole("list", { name: "Solicitudes pendientes" });
        expect(screen.queryByText("No tienes citas próximas.")).toBeNull();
        expect(screen.queryByRole("list", { name: "Próximas citas" })).toBeNull();

        server.appointments = () => ok(200, { consentRequired: false, appointments: [], requests: [] });
        await user.click(within(list).getByRole("button", { name: "Cancelar solicitud" }));
        await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Sí, cancelar solicitud" }));

        expect(await screen.findByText("No tienes citas próximas.")).toBeInTheDocument();
        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(screen.getByRole("status")).toHaveTextContent("Esta solicitud ya no está pendiente: fue respondida o venció.");
    });

    const cardOf = async (index: number) => within(await screen.findByRole("list", { name: "Próximas citas" })).getAllByRole("article")[ index ];

    it("shows each action only when the server allows it", async () => {
        render(<PortalAppointmentsPage slug={SLUG} />);
        const [ first, second ] = [ await cardOf(0), await cardOf(1) ];
        expect(within(first).getByRole("button", { name: "Reprogramar" })).toBeInTheDocument();
        expect(within(first).getByRole("button", { name: "Cancelar cita" })).toBeInTheDocument();
        expect(within(second).queryByRole("button", { name: "Reprogramar" })).toBeNull();
        expect(within(second).getByRole("button", { name: "Cancelar cita" })).toBeInTheDocument();

        listed = [ appt("a3", { canCancel: false, canReschedule: false }) ];
        cleanup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        expect(within(await cardOf(0)).getAllByRole("button").map((b) => b.textContent)).toEqual([ "Calendario" ]);
    });

    it("shows the video-call link when it is ready, and says it will arrive by email otherwise", async () => {
        const virtual = { name: "Sala virtual", address: null, instructions: null, isVirtual: true };
        listed = [
            appt("v1", { location: virtual, meeting: { status: "ready", url: "https://meet.example/abc" } }),
            appt("v2", { location: virtual, meeting: { status: "pending" }, startUtc: "2099-02-20T15:00:00.000Z", endUtc: "2099-02-20T16:00:00.000Z" }),
        ];
        render(<PortalAppointmentsPage slug={SLUG} />);
        const [ ready, pending ] = [ await cardOf(0), await cardOf(1) ];
        expect(ready).toHaveTextContent("Sala virtual, Videollamada");
        expect(within(ready).getByRole("link", { name: "Unirse a la videollamada" })).toHaveAttribute("href", "https://meet.example/abc");
        expect(within(pending).queryByRole("link", { name: "Unirse a la videollamada" })).toBeNull();
        expect(pending).toHaveTextContent("Te enviaremos el enlace de la videollamada.");
    });

    it("still lists and cancels while booking is paused, without offering a new booking", async () => {
        server.profile = { ...provider, bookingOpen: false };
        server.session = session({ bookingOpen: false });
        listed = [ appt("a1", { canReschedule: false }) ];
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);

        const card = await cardOf(0);
        expect(within(card).queryByRole("button", { name: "Reprogramar" })).toBeNull();
        expect(screen.queryByRole("link", { name: "Reservar una cita" })).toBeNull();
        expect(screen.getByTestId("portal-booking-paused")).toHaveTextContent(/en pausa/);

        await user.click(within(card).getByRole("button", { name: "Cancelar cita" }));
        await user.click(await screen.findByRole("button", { name: /Sí, cancelar/ }));
        await waitFor(() => expect(call("/portal/appointments/a1/cancel")).toHaveLength(1));
    });

    it("asks before cancelling, keeps the appointment on 'Volver' and cancels on confirm", async () => {
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        await user.click(within(await cardOf(0)).getByRole("button", { name: "Cancelar cita" }));

        const dialog = screen.getByRole("alertdialog", { name: "¿Cancelar esta cita?" });
        expect(dialog).toHaveTextContent(/20 de enero de 2099, 04:00 p\. m\./);
        await user.click(within(dialog).getByRole("button", { name: "Volver" }));
        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(call("/cancel")).toHaveLength(0);

        await user.click(within(await cardOf(0)).getByRole("button", { name: "Cancelar cita" }));
        listed = [ listed[ 1 ] ];
        await user.click(screen.getByRole("button", { name: "Sí, cancelar cita" }));

        expect(await screen.findByRole("status")).toHaveTextContent("Tu cita quedó cancelada");
        expect(call("/portal/appointments/a1/cancel")).toHaveLength(1);
        const [ , init ] = call("/portal/appointments/a1/cancel")[ 0 ];
        expect(init.method).toBe("POST");
        expect(new Headers(init.headers).get("X-CSRF-Token")).toBe("csrf-from-session");
        expect(within(await screen.findByRole("list", { name: "Próximas citas" })).getAllByRole("article")).toHaveLength(1);
        expect(call("/portal/appointments").length).toBeGreaterThanOrEqual(2);
        // The result keeps focus through the list reload (it is never unmounted behind the skeleton).
        expect(screen.getByRole("status")).toHaveFocus();
    });

    it("closes the dialog and refreshes the list when the appointment can no longer be changed", async () => {
        server.cancel = () => fail(404, "Appointment not found");
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        await user.click(within(await cardOf(0)).getByRole("button", { name: "Cancelar cita" }));
        await user.click(screen.getByRole("button", { name: "Sí, cancelar cita" }));

        expect(await screen.findByRole("status")).toHaveTextContent("Esta cita ya no se puede modificar");
        expect(screen.queryByRole("alertdialog")).toBeNull();
    });

    it("keeps the dialog open with the error on a server failure", async () => {
        server.cancel = () => fail(503, "unavailable");
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        await user.click(within(await cardOf(0)).getByRole("button", { name: "Cancelar cita" }));
        await user.click(screen.getByRole("button", { name: "Sí, cancelar cita" }));

        const dialog = await screen.findByRole("alertdialog");
        await waitFor(() => expect(dialog).toHaveTextContent(/error en el servidor/));
    });

    it("shows the old time beside the new one, which stays empty until a time is picked", async () => {
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        await user.click(within(await cardOf(0)).getByRole("button", { name: "Reprogramar" }));

        const change = await screen.findByTestId("reschedule-change");
        expect(within(change).getByText("Antes")).toBeInTheDocument();
        expect(within(change).getByText("Ahora")).toBeInTheDocument();
        expect(within(change).getByText("Elige un horario")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Confirmar nuevo horario" })).toBeDisabled();

        await user.click(within(await screen.findByRole("list", { name: "Mañana" })).getByRole("button"));

        expect(within(change).queryByText("Elige un horario")).toBeNull();
        expect(screen.getByRole("button", { name: "Confirmar nuevo horario" })).toBeEnabled();
    });

    it("says nothing about how many changes remain", async () => {
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        await user.click(within(await cardOf(0)).getByRole("button", { name: "Reprogramar" }));
        await screen.findByRole("list", { name: "Mañana" });

        expect(screen.queryByText(/Te queda/)).toBeNull();
    });

    it("keeps the next appointment above pending requests", async () => {
        server.appointments = () => ok(200, {
            consentRequired: false,
            appointments: listed,
            requests: [ {
                id: "r1", status: "PENDING", startUtc: "2099-03-01T15:00:00.000Z", endUtc: "2099-03-01T16:00:00.000Z", durationMinutes: 60,
                holdExpiresAt: "2099-02-01T00:00:00.000Z", type: { name: "Control" }, location: { name: "Consultorio Centro", address: "Calle 10", isVirtual: false },
            } ],
        });
        render(<PortalAppointmentsPage slug={SLUG} />);

        const next = await screen.findByText("Tu próxima cita");
        const requests = screen.getByRole("list", { name: "Solicitudes pendientes" });
        expect(next.compareDocumentPosition(requests) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("highlights only the next appointment", async () => {
        listed = [ appt("a1"), appt("a2") ];
        render(<PortalAppointmentsPage slug={SLUG} />);

        const list = await screen.findByRole("list", { name: "Próximas citas" });
        const [ next, later ] = within(list).getAllByRole("article");
        expect(within(next!).getByText("Tu próxima cita")).toBeInTheDocument();
        expect(within(later!).queryByText("Tu próxima cita")).toBeNull();
    });

    it("the next appointment leads with the video call when its link is ready", async () => {
        listed = [ appt("a1", { meeting: { status: "ready", url: "https://meet.example/abc" } }) ];
        render(<PortalAppointmentsPage slug={SLUG} />);

        const link = within(await cardOf(0)).getByRole("link", { name: "Unirse a la videollamada" });
        expect(link).toHaveAttribute("href", "https://meet.example/abc");
        expect(link).toHaveClass("btn-primary");
    });

    it("the next appointment leads with directions for an in-person place", async () => {
        render(<PortalAppointmentsPage slug={SLUG} />);

        const link = within(await cardOf(0)).getByRole("link", { name: "Cómo llegar" });
        expect(link).toHaveAttribute("href", expect.stringContaining("query=Calle%2010"));
        expect(link).toHaveClass("btn-primary");
    });

    it("only the next appointment offers directions", async () => {
        listed = [ appt("a1"), appt("a2") ];
        render(<PortalAppointmentsPage slug={SLUG} />);
        await cardOf(0);

        expect(within(await cardOf(1)).queryByRole("link", { name: "Cómo llegar" })).toBeNull();
    });

    it("offers no main action without a link or an address", async () => {
        listed = [ appt("a1", { location: { name: "Consultorio", address: null, instructions: null, isVirtual: false } }) ];
        render(<PortalAppointmentsPage slug={SLUG} />);

        const card = await cardOf(0);
        expect(within(card).queryByRole("link")).toBeNull();
    });

    it("downloads the next appointment for the calendar", async () => {
        URL.createObjectURL = vi.fn(() => "blob:ics");
        URL.revokeObjectURL = vi.fn();
        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);

        await user.click(within(await cardOf(0)).getByRole("button", { name: "Calendario" }));

        expect(click).toHaveBeenCalledOnce();
        click.mockRestore();
    });

    it("reschedules to a new time in the device zone and returns to the list", async () => {
        let sent: unknown;
        server.reschedule = (_id, body) => {
            sent = body;
            listed = [ appt("a1", { startUtc: morning, endUtc: morning }) ];
            return ok(200, { appointment: listed[ 0 ] });
        };
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        await user.click(within(await cardOf(0)).getByRole("button", { name: "Reprogramar" }));

        expect(await screen.findByRole("heading", { level: 2, name: "Reprogramar cita" })).toHaveFocus();
        const slotsUrl = String(slotCalls()[ 0 ][ 0 ]);
        expect(slotsUrl).toContain("/portal/appointments/a1/slots?from=");
        expect(slotsUrl).not.toContain("typeId");
        expect(slotCalls()[ 0 ][ 1 ].credentials).toBe("include");
        await user.click(within(await screen.findByRole("list", { name: "Mañana" })).getByRole("button"));
        await user.click(screen.getByRole("button", { name: "Confirmar nuevo horario" }));

        expect(await screen.findByRole("status")).toHaveTextContent("Tu cita quedó reprogramada");
        expect(sent).toEqual({ startUtc: morning, patientTimezone: "Europe/Madrid" });
        expect(call("/portal/appointments/a1/reschedule")).toHaveLength(1);
    });

    it("drops a taken time, says why and reloads the slots", async () => {
        server.reschedule = () => fail(409, "Slot no longer available");
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        await user.click(within(await cardOf(0)).getByRole("button", { name: "Reprogramar" }));
        await user.click(within(await screen.findByRole("list", { name: "Mañana" })).getByRole("button"));
        await user.click(await screen.findByRole("button", { name: "Confirmar nuevo horario" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Ese horario ya no está disponible");
        expect(screen.getByRole("button", { name: "Confirmar nuevo horario" })).toBeDisabled();
        await waitFor(() => expect(slotCalls().length).toBeGreaterThanOrEqual(2));
        expect(screen.getByRole("heading", { name: "Reprogramar cita" })).toBeInTheDocument();
    });

    it("returns to the list with the reason when the appointment can no longer be moved online", async () => {
        server.reschedule = () => fail(409, "Reschedule unavailable");
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        await user.click(within(await cardOf(0)).getByRole("button", { name: "Reprogramar" }));
        await user.click(within(await screen.findByRole("list", { name: "Mañana" })).getByRole("button"));
        await user.click(await screen.findByRole("button", { name: "Confirmar nuevo horario" }));

        expect(await screen.findByRole("status")).toHaveTextContent("ya no se puede reprogramar en línea");
        expect(await screen.findByRole("list", { name: "Próximas citas" })).toBeInTheDocument();
    });

    it("returns to the list with the reason when the times say it can no longer be moved", async () => {
        server.slots = () => fail(409, "Reschedule unavailable");
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        await user.click(within(await cardOf(0)).getByRole("button", { name: "Reprogramar" }));

        expect(await screen.findByRole("status")).toHaveTextContent("ya no se puede reprogramar en línea");
        expect(await screen.findByRole("list", { name: "Próximas citas" })).toBeInTheDocument();
        expect(call("/reschedule")).toHaveLength(0);
    });

    it("goes back to the login when loading the times answers 401", async () => {
        server.slots = () => fail(401, "Invalid session");
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        await user.click(within(await cardOf(0)).getByRole("button", { name: "Reprogramar" }));
        expect(await screen.findByRole("heading", { name: "Esta página de reservas no está disponible" })).toBeInTheDocument();
    });

    it("goes back without a request, and to the login when the session expired", async () => {
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        await user.click(within(await cardOf(0)).getByRole("button", { name: "Reprogramar" }));
        await user.click(await screen.findByRole("button", { name: "Volver a mis citas" }));
        expect(await screen.findByRole("list", { name: "Próximas citas" })).toBeInTheDocument();
        expect(call("/reschedule")).toHaveLength(0);

        server.reschedule = () => fail(401, "Invalid session");
        await user.click(within(await cardOf(0)).getByRole("button", { name: "Reprogramar" }));
        await user.click(within(await screen.findByRole("list", { name: "Mañana" })).getByRole("button"));
        server.session = null;
        await user.click(await screen.findByRole("button", { name: "Confirmar nuevo horario" }));
        expect(await screen.findByRole("heading", { name: "Esta página de reservas no está disponible" })).toBeInTheDocument();
    });
});
