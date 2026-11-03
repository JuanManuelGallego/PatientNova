import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/utils/TimeUtils", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/src/utils/TimeUtils")>(),
    browserTimezone: () => "Europe/Madrid",
}));

import { PortalAppointmentsPage } from "@/src/components/PublicBooking/PortalAppointmentsPage";
import { RESEND_COOLDOWN_SECONDS } from "@/src/components/PublicBooking/PortalLogin";
import { csrfStore } from "@/src/api/base/csrfStore";
import { todayFormattedString } from "@/src/utils/TimeUtils";

vi.mock("@/src/components/TurnstileWidget", async () => {
    const { useImperativeHandle } = await import("react");
    return {
        TurnstileWidget: ({ action, onToken, onError, ref }: {
            action: string; onToken: (t: string | null) => void; onError?: () => void; ref?: React.Ref<{ reset: () => void }>;
        }) => {
            useImperativeHandle(ref, () => ({ reset: () => onToken(null) }), [ onToken ]);
            return (
                <>
                    <button type="button" data-action={action} onClick={() => onToken(`captcha-${action}`)}>Resolver captcha</button>
                    <button type="button" onClick={() => onError?.()}>Fallar captcha</button>
                </>
            );
        },
    };
});

const SLUG = "dra-ana";
const provider = {
    displayName: "Dra. Ana Pública",
    jobTitle: "Psicóloga",
    hasAvatar: false,
    hasLogo: false,
    timezone: "America/Bogota",
    bookingOpen: true,
    approvalRequired: false,
    lastBookableDate: "2099-12-31",
    types: [],
    locations: [],
};
const session = (overrides: Record<string, unknown> = {}) => ({
    email: "ana@example.com",
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
    verify: () => Response;
    otp: () => Response;
    challenges: number;
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
        verify: () => {
            server.session = session({ consentRequired: true });
            return ok(200, { email: "ana@example.com", expiresAt: "2099-01-01T02:00:00.000Z", csrfToken: "csrf-from-verify" });
        },
        otp: () => {
            server.challenges += 1;
            return ok(202, { challenge: `challenge-${server.challenges}` });
        },
        challenges: 0,
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
        if (path === `/public/providers/${SLUG}/otp`) return server.otp();
        if (path === `/portal/${SLUG}/otp/verify`) return server.verify();
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

const bodyOf = (path: string, i = 0) => JSON.parse(String(call(path)[ i ][ 1 ].body));

async function requestCode(user: ReturnType<typeof userEvent.setup>) {
    await user.type(await screen.findByLabelText("Correo electrónico"), "  ana@example.com ");
    await user.click(screen.getByRole("button", { name: "Resolver captcha" }));
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    return screen.findByLabelText("Código de 6 dígitos");
}

describe("PortalAppointmentsPage", () => {
    it("logs in with an emailed code, records consent and shows the placeholder", async () => {
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);

        const emailInput = await screen.findByLabelText("Correo electrónico");
        expect(emailInput).toHaveAttribute("type", "email");
        expect(emailInput).toHaveAttribute("autocomplete", "email");
        expect(screen.getByRole("button", { name: "Resolver captcha" })).toHaveAttribute("data-action", "otp-request");

        const codeInput = await requestCode(user);
        expect(bodyOf(`/public/providers/${SLUG}/otp`)).toEqual({ email: "ana@example.com", captchaToken: "captcha-otp-request" });
        expect(call(`/public/providers/${SLUG}/otp`)[ 0 ][ 1 ].credentials).toBe("omit");
        expect(screen.getByText(/Si el correo es válido, te enviamos un código/)).toBeInTheDocument();
        expect(codeInput).toHaveAttribute("inputmode", "numeric");
        expect(codeInput).toHaveAttribute("autocomplete", "one-time-code");
        expect(codeInput).toHaveAttribute("maxlength", "6");

        await user.type(codeInput, "12a34567");
        expect(codeInput).toHaveValue("123456");
        await user.click(screen.getByRole("button", { name: "Ingresar" }));

        expect(await screen.findByRole("heading", { name: "Antes de continuar" })).toBeInTheDocument();
        expect(bodyOf(`/portal/${SLUG}/otp/verify`)).toEqual({ email: "ana@example.com", code: "123456", challenge: "challenge-1" });
        expect(call(`/portal/${SLUG}/otp/verify`)[ 0 ][ 1 ].credentials).toBe("include");

        expect(screen.getByRole("link", { name: "Política de privacidad" })).toHaveAttribute("target", "_blank");
        const accept = screen.getByRole("button", { name: "Continuar" });
        expect(accept).toBeDisabled();
        await user.click(screen.getByRole("checkbox"));
        await user.click(accept);

        expect(await screen.findByText("No tienes citas próximas.")).toBeInTheDocument();
        const [ , consentInit ] = call("/portal/consent")[ 0 ];
        expect(JSON.parse(String(consentInit.body))).toEqual({ accepted: true });
        expect((consentInit.headers as Record<string, string>)[ "X-CSRF-Token" ]).toBe("csrf-from-session");
        expect(call("/portal/session")).toHaveLength(2);
    });

    it("keeps the submit disabled until the CAPTCHA gives a token", async () => {
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        await user.type(await screen.findByLabelText("Correo electrónico"), "ana@example.com");
        const submit = screen.getByRole("button", { name: "Enviar código" });
        expect(submit).toBeDisabled();
        expect(screen.getByText("Comprobando que eres una persona…")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Resolver captcha" }));
        expect(submit).toBeEnabled();
        expect(screen.queryByText("Comprobando que eres una persona…")).not.toBeInTheDocument();
    });

    it("stops saying it is checking once the CAPTCHA widget fails (it shows its own error)", async () => {
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        await screen.findByText("Comprobando que eres una persona…");
        await user.click(screen.getByRole("button", { name: "Fallar captcha" }));
        expect(screen.queryByText("Comprobando que eres una persona…")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Enviar código" })).toBeDisabled();
    });

    it("counts down the resend, then sends a new code that replaces the challenge", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<PortalAppointmentsPage slug={SLUG} />);
        const codeInput = await requestCode(user);

        const resend = screen.getByRole("button", { name: `Reenviar código (${RESEND_COOLDOWN_SECONDS} s)` });
        expect(resend).toBeDisabled();
        for (let i = 0; i < RESEND_COOLDOWN_SECONDS; i++) await act(async () => { vi.advanceTimersByTime(1000); });

        const ready = screen.getByRole("button", { name: "Reenviar código" });
        expect(ready).toBeDisabled();
        await user.click(screen.getByRole("button", { name: "Resolver captcha" }));
        await user.click(ready);
        await screen.findByRole("button", { name: `Reenviar código (${RESEND_COOLDOWN_SECONDS} s)` });
        expect(call(`/public/providers/${SLUG}/otp`)).toHaveLength(2);

        await user.type(codeInput, "654321");
        await user.click(screen.getByRole("button", { name: "Ingresar" }));
        await waitFor(() => expect(call(`/portal/${SLUG}/otp/verify`)).toHaveLength(1));
        expect(bodyOf(`/portal/${SLUG}/otp/verify`).challenge).toBe("challenge-2");
    });

    it("shows the wrong-code message, clears the field and lets the patient change the email", async () => {
        server.verify = () => fail(400, "Invalid or expired code");
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        const codeInput = await requestCode(user);

        await user.type(codeInput, "000000");
        await user.click(screen.getByRole("button", { name: "Ingresar" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("El código no es válido o ya expiró");
        expect(codeInput).toHaveValue("");

        await user.click(screen.getByRole("button", { name: "Cambiar correo" }));
        expect((screen.getByLabelText("Correo electrónico") as HTMLInputElement).value.trim()).toBe("ana@example.com");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("maps a CAPTCHA rejection to Spanish and stays on the email step", async () => {
        server.otp = () => fail(400, "CAPTCHA verification failed");
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        await user.type(await screen.findByLabelText("Correo electrónico"), "ana@example.com");
        await user.click(screen.getByRole("button", { name: "Resolver captcha" }));
        await user.click(screen.getByRole("button", { name: "Enviar código" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos verificar que eres una persona");
        expect(screen.getByRole("button", { name: "Enviar código" })).toBeDisabled();
    });

    it("shows the login when the session belongs to another provider", async () => {
        server.session = session({ providerSlug: "otro-profesional" });
        render(<PortalAppointmentsPage slug={SLUG} />);
        expect(await screen.findByLabelText("Correo electrónico")).toBeInTheDocument();
        expect(screen.queryByText("No tienes citas próximas.")).not.toBeInTheDocument();
    });

    it("resumes an existing session on reload and logs out back to the login", async () => {
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

        expect(await screen.findByLabelText("Correo electrónico")).toBeInTheDocument();
        expect((call("/portal/logout")[ 0 ][ 1 ].headers as Record<string, string>)[ "X-CSRF-Token" ]).toBe("csrf-from-session");
        expect(csrfStore.get()).toBeNull();
    });

    it("goes back to the login when consent answers 401", async () => {
        server.session = session({ consentRequired: true });
        fetchMock.mockImplementation(async (url: string) => {
            const path = url.replace(/^.*\/v1/, "");
            if (path === `/public/providers/${SLUG}`) return ok(200, provider);
            if (path === "/portal/session") return ok(200, server.session);
            return fail(401, "Invalid session");
        });
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        await user.click(await screen.findByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Continuar" }));
        expect(await screen.findByLabelText("Correo electrónico")).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("Tu sesión expiró");
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

    it("returning to the same email goes back to the code step without a new request", async () => {
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        await requestCode(user);

        await user.click(screen.getByRole("button", { name: "Cambiar correo" }));
        const emailInput = screen.getByLabelText("Correo electrónico");
        await user.clear(emailInput);
        await user.type(emailInput, "ANA@example.com");
        await user.click(screen.getByRole("button", { name: "Ingresar el código enviado" }));

        const codeInput = await screen.findByLabelText("Código de 6 dígitos");
        expect(screen.getByRole("button", { name: /Reenviar código \(\d+ s\)/ })).toBeDisabled();
        expect(call(`/public/providers/${SLUG}/otp`)).toHaveLength(1);

        await user.type(codeInput, "123456");
        await user.click(screen.getByRole("button", { name: "Ingresar" }));
        await waitFor(() => expect(call(`/portal/${SLUG}/otp/verify`)).toHaveLength(1));
        expect(bodyOf(`/portal/${SLUG}/otp/verify`)).toMatchObject({ email: "ana@example.com", challenge: "challenge-1" });
    });

    it("a different email needs the CAPTCHA and sends a new code", async () => {
        const user = userEvent.setup();
        render(<PortalAppointmentsPage slug={SLUG} />);
        await requestCode(user);
        await user.click(screen.getByRole("button", { name: "Cambiar correo" }));
        const emailInput = screen.getByLabelText("Correo electrónico");
        await user.clear(emailInput);
        await user.type(emailInput, "otra@example.com");

        const send = screen.getByRole("button", { name: "Enviar código" });
        expect(send).toBeDisabled();
        await user.click(screen.getByRole("button", { name: "Resolver captcha" }));
        await user.click(send);
        await screen.findByLabelText("Código de 6 dígitos");
        expect(bodyOf(`/public/providers/${SLUG}/otp`, 1).email).toBe("otra@example.com");
        expect(screen.getByText("otra@example.com")).toBeInTheDocument();
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
        expect(await screen.findByLabelText("Correo electrónico")).toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
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
        expect(await screen.findByLabelText("Correo electrónico")).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("Tu sesión expiró");
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
        expect(card).toHaveTextContent("Pendiente de confirmación");
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
        expect(within(await cardOf(0)).queryByRole("button")).toBeNull();
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
        expect(pending).toHaveTextContent("El enlace de la videollamada llegará a tu correo.");
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
        expect(screen.getByRole("heading", { level: 3, name: /Día/ })).toBeInTheDocument();
        expect(screen.getByRole("heading", { level: 3, name: /Hora/ })).toBeInTheDocument();
        expect(screen.getByText("Cita actual")).toBeInTheDocument();
        const slotsUrl = String(slotCalls()[ 0 ][ 0 ]);
        expect(slotsUrl).toContain("/portal/appointments/a1/slots?from=");
        expect(slotsUrl).not.toContain("typeId");
        expect(slotCalls()[ 0 ][ 1 ].credentials).toBe("include");
        await user.click(within(await screen.findByRole("list", { name: "Mañana" })).getByRole("button"));
        expect(await screen.findByRole("heading", { name: /Confirma el cambio/ })).toBeInTheDocument();
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
        expect(screen.queryByRole("heading", { name: /Confirma el cambio/ })).toBeNull();
        await waitFor(() => expect(slotCalls()).toHaveLength(2));
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
        expect(await screen.findByLabelText("Correo electrónico")).toBeInTheDocument();
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
        expect(await screen.findByLabelText("Correo electrónico")).toBeInTheDocument();
    });
});
