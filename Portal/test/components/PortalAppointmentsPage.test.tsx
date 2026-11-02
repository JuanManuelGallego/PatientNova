import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/utils/TimeUtils", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/src/utils/TimeUtils")>(),
    browserTimezone: () => "Europe/Madrid",
}));

import { PortalAppointmentsPage } from "@/src/components/PublicBooking/PortalAppointmentsPage";
import { RESEND_COOLDOWN_SECONDS } from "@/src/components/PublicBooking/PortalLogin";
import { csrfStore } from "@/src/api/base/csrfStore";

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
    ...overrides,
});

const ok = (status: number, data?: unknown) =>
    status === 204 ? new Response(null, { status }) : new Response(JSON.stringify({ success: true, data }), { status });
const fail = (status: number, error: string) => new Response(JSON.stringify({ success: false, error }), { status });

interface Server {
    profileStatus: number;
    session: ReturnType<typeof session> | null;
    verify: () => Response;
    otp: () => Response;
    challenges: number;
    logoutFails?: boolean;
    appointments: () => Response;
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
    };
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string, init: RequestInit = {}) => {
        const path = url.replace(/^.*\/v1/, "").toLowerCase();
        if (path === `/public/providers/${SLUG}`) {
            return server.profileStatus === 200 ? ok(200, provider) : fail(server.profileStatus, "Provider not found");
        }
        if (path === `/public/providers/${SLUG}/otp`) return server.otp();
        if (path === `/portal/${SLUG}/otp/verify`) return server.verify();
        if (path === "/portal/session") return server.session ? ok(200, server.session) : fail(401, "Invalid session");
        if (path === "/portal/consent") return ok(204);
        if (path === "/portal/appointments") return server.appointments();
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
        location: { name: "Consultorio Centro", address: "Calle 10", instructions: "Timbre 2" },
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
