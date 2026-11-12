import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicBookingPage } from "@/src/components/PublicBooking/PublicBookingPage";
import { todayFormattedString } from "@/src/utils/TimeUtils";

vi.mock("@/src/components/TurnstileWidget", async () => {
    const { useImperativeHandle } = await import("react");
    return {
        TurnstileWidget: ({ action, onToken, ref }: {
            action: string; onToken: (t: string | null) => void; ref?: React.Ref<{ reset: () => void }>;
        }) => {
            useImperativeHandle(ref, () => ({ reset: () => onToken(null) }), [ onToken ]);
            return <button type="button" data-action={action} onClick={() => onToken(`captcha-${action}`)}>Resolver captcha</button>;
        },
    };
});

vi.mock("@/src/utils/TimeUtils", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/src/utils/TimeUtils")>(),
    browserTimezone: () => "America/Bogota",
}));

const TZ = "America/Bogota";
const today = todayFormattedString(TZ);
const morningSlot = `${today}T14:00:00.000Z`;

const baseProvider = {
    displayName: "Dra. Ana Pública",
    jobTitle: "Psicóloga",
    specialty: null as string | null,
    bio: null as string | null,
    phone: null as string | null,
    whatsapp: null as string | null,
    legal: { name: "Consultorio Prueba S.A.S.", privacyContact: "privacidad@example.com", contactHours: "Lunes a viernes, 8:00 a 17:00" },
    hasAvatar: false,
    hasLogo: false,
    timezone: TZ,
    bookingOpen: true,
    approvalRequired: false,
    selfServe: true,
    whatsappConfirmation: true,
    reschedulePolicy: { maxReschedules: 2, minNoticeHours: 24 } as { maxReschedules: number; minNoticeHours: number } | null,
    lastBookableDate: "2099-12-31",
    types: [ { id: "t1", name: "Primera consulta", description: null, durationMinutes: 60, price: 150000 } ],
    locations: [ { id: "l1", name: "Consultorio Centro", address: "Calle 10" as string | null, isVirtual: false } ],
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const fail = (status: number, error: string) => json(status, { success: false, error });
const pendingDto = (overrides: Record<string, unknown> = {}) => ({
    channel: "EMAIL",
    contact: "ana@example.com",
    startUtc: morningSlot,
    holdExpiresAt: "2099-01-01T00:00:00.000Z",
    approvalRequired: false,
    releaseToken: "release-token-1",
    ...overrides,
});

const fetchMock = vi.fn();
interface Server {
    provider: typeof baseProvider;
    start: (body: Record<string, unknown>) => Response;
    release: () => Response;
}
let server: Server;

const calls = (path: string) => fetchMock.mock.calls.filter(([ url ]) => String(url).replace(/^.*\/v1/, "").startsWith(path));
const START = "/public/providers/dra-ana/bookings";
const RELEASE = "/public/booking-confirmations/release";
const sentBody = (n = 0) => JSON.parse(String(calls(START)[ n ][ 1 ].body)) as Record<string, unknown> & { locationId?: string };

beforeEach(() => {
    server = {
        provider: baseProvider,
        start: () => json(202, { success: true, data: pendingDto() }),
        release: () => new Response(null, { status: 204 }),
    };
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string, init: RequestInit = {}) => {
        const path = String(url).replace(/^.*\/v1/, "");
        if (path.includes("/slots?")) return json(200, { success: true, data: { timezone: TZ, slots: [ { startUtc: morningSlot, endUtc: morningSlot } ] } });
        if (path === "/public/providers/dra-ana") return json(200, { success: true, data: server.provider });
        if (path === START) return server.start(JSON.parse(String(init.body)));
        if (path === RELEASE) return server.release();
        throw new Error(`unexpected ${init.method ?? "GET"} ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.history.replaceState(null, "");
});

type User = ReturnType<typeof userEvent.setup>;

async function toDetails(user: User) {
    const morning = await screen.findByRole("list", { name: "Mañana" });
    await user.click(within(morning).getByRole("button"));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("heading", { name: "Último paso" });
}

async function fillName(user: User) {
    await user.type(screen.getByLabelText("Nombre"), "  Lucía ");
    await user.type(screen.getByLabelText("Apellidos"), "Rojas");
}

async function fillByEmail(user: User, submitName = "Reservar cita") {
    await fillName(user);
    await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Resolver captcha" }));
    await user.click(screen.getByRole("button", { name: submitName }));
}

async function chooseWhatsapp(user: User) {
    await user.click(screen.getByRole("button", { name: "WhatsApp" }));
    await user.type(screen.getByLabelText("Número de WhatsApp"), "+57 300 111 2233");
}

describe("PatientDetailsStep", () => {
    it("asks for name, last name, a confirmation channel (Correo / WhatsApp), the matching contact field, consent and CAPTCHA", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);

        expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
        expect(screen.getByLabelText("Apellidos")).toBeInTheDocument();
        const channels = screen.getByRole("group", { name: "Recibir el enlace de confirmación por" });
        expect(within(channels).getAllByRole("button").map((b) => b.textContent)).toEqual([ "Correo", "WhatsApp" ]);
        expect(within(channels).getByRole("button", { name: "Correo" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
        expect(screen.queryByLabelText("Número de WhatsApp")).not.toBeInTheDocument();
        expect(screen.getByRole("checkbox")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Resolver captcha" })).toHaveAttribute("data-action", "booking");
        expect(screen.getByTestId("access-notice")).toHaveTextContent(
            "Al reservar solicitas a Consultorio Prueba S.A.S. que utilice este contacto para enviarte el enlace de confirmación de tu cita mediante Patient Nova. No incluyas datos de salud en este paso.",
        );

        await user.click(within(channels).getByRole("button", { name: "WhatsApp" }));
        expect(screen.getByLabelText("Número de WhatsApp")).toBeInTheDocument();
        expect(screen.queryByLabelText("Correo electrónico")).not.toBeInTheDocument();
    });

    it("offers only email, with no channel choice, until WhatsApp confirmation is available", async () => {
        server.provider = { ...baseProvider, whatsappConfirmation: false };
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);

        expect(screen.queryByRole("group", { name: "Recibir el enlace de confirmación por" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "WhatsApp" })).not.toBeInTheDocument();
        expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
        await fillByEmail(user);
        await screen.findByRole("heading", { name: "Revisa tu correo" });
        expect(sentBody().contact).toEqual({ channel: "EMAIL", email: "ana@example.com" });
    });

    it("shows the optional phone only for the email channel", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);

        expect(screen.getByLabelText("Teléfono (opcional)")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "WhatsApp" }));
        expect(screen.queryByLabelText("Teléfono (opcional)")).not.toBeInTheDocument();
    });

    it("submits contact + patient + captchaToken and never price, end or status", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await user.type(screen.getByLabelText("Teléfono (opcional)"), "+57 300 111 9999");
        await fillByEmail(user);

        await screen.findByRole("heading", { name: "Revisa tu correo" });
        const [ , init ] = calls(START)[ 0 ];
        expect(sentBody()).toEqual({
            typeId: "t1",
            locationId: "l1",
            startUtc: morningSlot,
            patientTimezone: TZ,
            consentAccepted: true,
            captchaToken: "captcha-booking",
            patient: { name: "Lucía", lastName: "Rojas", phone: "+573001119999" },
            contact: { channel: "EMAIL", email: "ana@example.com" },
        });
        expect(init.credentials).toBe("omit");
        expect(JSON.stringify(sentBody())).not.toMatch(/price|endUtc|status/);
    });

    it("sends a WhatsApp number as the contact and no patient phone", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillName(user);
        await chooseWhatsapp(user);
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Resolver captcha" }));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));

        await waitFor(() => expect(calls(START)).toHaveLength(1));
        expect(sentBody().contact).toEqual({ channel: "WHATSAPP", phone: "+573001112233" });
        expect(sentBody().patient).toEqual({ name: "Lucía", lastName: "Rojas" });
    });

    it("points at each missing field, then at the CAPTCHA wait, without calling the server", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);

        expect(screen.getByRole("button", { name: "Reservar cita" })).toBeDisabled();
        await user.click(screen.getByRole("button", { name: "Resolver captcha" }));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));
        expect(screen.getByLabelText("Nombre")).toHaveFocus();
        expect(screen.getByLabelText("Nombre")).toHaveAccessibleDescription("Escribe tu nombre.");
        expect(screen.getByText("Escribe tus apellidos.")).toBeInTheDocument();
        expect(screen.getByText("Escribe un correo válido.")).toBeInTheDocument();
        expect(screen.getByText("Marca la autorización para continuar, o contacta directamente a la clínica.")).toBeInTheDocument();
        expect(calls(START)).toHaveLength(0);
    });

    it("validates the optional phone and the WhatsApp number", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);

        const phone = screen.getByLabelText("Teléfono (opcional)");
        await user.type(phone, "300");
        expect(phone).not.toHaveAttribute("aria-invalid");
        await user.tab();
        expect(phone).toHaveAttribute("aria-invalid", "true");

        await user.click(screen.getByRole("button", { name: "WhatsApp" }));
        const whatsapp = screen.getByLabelText("Número de WhatsApp");
        await user.type(whatsapp, "300");
        await user.tab();
        expect(whatsapp).toHaveAttribute("aria-invalid", "true");
    });

    it("states the cancel and reschedule policy only when the provider has Mis citas", async () => {
        const user = userEvent.setup();
        const first = render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        expect(screen.getByTestId("booking-policy")).toHaveTextContent("Puedes cancelarla desde Mis citas");
        first.unmount();
        window.history.replaceState(null, "");

        server.provider = { ...baseProvider, selfServe: false, reschedulePolicy: null };
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        expect(screen.queryByTestId("booking-policy")).not.toBeInTheDocument();
    });

    it("a 409 slot taken clears the slot and returns to Horario with the server message", async () => {
        server.start = () => fail(409, "Slot no longer available");
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillByEmail(user);

        expect(await screen.findByRole("heading", { name: "¿Cuándo te queda bien?" })).toBeInTheDocument();
        expect(await screen.findByRole("alert")).toHaveTextContent("Ese horario ya no está disponible. Elige otro.");
        expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    });

    it("WhatsAppUnavailableError switches the choice to Correo and shows the message", async () => {
        server.start = () => fail(409, "Por ahora no podemos enviar mensajes por WhatsApp. Usa tu correo para reservar.");
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillName(user);
        await chooseWhatsapp(user);
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Resolver captcha" }));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Por ahora no podemos enviar mensajes por WhatsApp. Usa tu correo para reservar.");
        expect(screen.getByRole("button", { name: "Correo" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
        expect(screen.getByLabelText("Nombre")).toHaveValue("  Lucía ");
    });

    it("keeps the form with the capacity and request-limit messages", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillByEmail(user);
        expect(await screen.findByRole("heading", { name: "Revisa tu correo" })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "¿Te equivocaste? Corregir" }));

        server.start = () => fail(429, "No hay cupo para nuevas reservas en este momento. Intenta de nuevo en un rato.");
        await user.click(await screen.findByRole("button", { name: "Resolver captcha" }));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("No hay cupo para nuevas reservas en este momento. Intenta de nuevo en un rato.");

        server.start = () => fail(503, "No pudimos enviar el enlace de confirmación. Revisa el dato de contacto o inténtalo de nuevo en unos minutos.");
        await user.click(screen.getByRole("button", { name: "Resolver captcha" }));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));
        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No pudimos enviar el enlace de confirmación"));

        server.start = () => fail(409, "Request limit reached");
        await user.click(screen.getByRole("button", { name: "Resolver captcha" }));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));
        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Ya tienes varias reservas en curso con este profesional"));
        expect(screen.getByLabelText("Correo electrónico")).toHaveValue("ana@example.com");
    });

    it("in approval mode says so and sends a request", async () => {
        server.provider = { ...baseProvider, approvalRequired: true, reschedulePolicy: null };
        server.start = () => json(202, { success: true, data: pendingDto({ approvalRequired: true }) });
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);

        expect(screen.getByTestId("booking-approval-note")).toHaveTextContent(/mientras Dra\. Ana Pública revisa tu solicitud/);
        expect(screen.queryByRole("button", { name: "Reservar cita" })).not.toBeInTheDocument();
        await fillByEmail(user, "Enviar solicitud");

        expect(await screen.findByRole("heading", { name: "Revisa tu correo" })).toHaveFocus();
        expect(screen.getByTestId("booking-pending")).toHaveTextContent("Tu solicitud todavía no se ha enviado.");
    });
});

describe("BookingResult", () => {
    it("the result says the appointment is not confirmed until the link is clicked and names where it went", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillByEmail(user);

        expect(await screen.findByRole("heading", { name: "Revisa tu correo" })).toHaveFocus();
        expect(screen.getByTestId("booking-pending")).toHaveTextContent(
            "Tu cita todavía no está confirmada. Te enviamos un enlace a ana@example.com. Ábrelo y confirma en los próximos 15 minutos; si no, el horario quedará libre.",
        );
        expect(screen.queryByText(/Tu cita quedó reservada/)).not.toBeInTheDocument();
    });

    it("names the WhatsApp number when the link went there", async () => {
        server.start = () => json(202, { success: true, data: pendingDto({ channel: "WHATSAPP", contact: "+573001112233" }) });
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillName(user);
        await chooseWhatsapp(user);
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Resolver captcha" }));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));

        expect(await screen.findByRole("heading", { name: "Revisa tu WhatsApp" })).toBeInTheDocument();
        expect(screen.getByTestId("booking-pending")).toHaveTextContent("+57 300 111 2233");
    });

    it('"¿Te equivocaste? Corregir" releases the hold and returns to details with the slot and form kept', async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await user.click(screen.getByRole("button", { name: "WhatsApp" }));
        await user.click(screen.getByRole("button", { name: "Correo" }));
        await fillByEmail(user);
        await screen.findByRole("heading", { name: "Revisa tu correo" });

        await user.click(screen.getByRole("button", { name: "¿Te equivocaste? Corregir" }));

        expect(await screen.findByRole("heading", { name: "Último paso" })).toBeInTheDocument();
        expect(calls(RELEASE)).toHaveLength(1);
        const [ , init ] = calls(RELEASE)[ 0 ];
        expect(JSON.parse(String(init.body))).toEqual({ releaseToken: "release-token-1" });
        expect(init.credentials).toBe("omit");
        expect(screen.getByLabelText("Nombre")).toHaveValue("  Lucía ");
        expect(screen.getByLabelText("Correo electrónico")).toHaveValue("ana@example.com");
        expect(screen.getByRole("checkbox")).toBeChecked();
        expect(screen.getByTestId("booking-summary")).toHaveTextContent("Primera consulta");
        expect(screen.getByRole("button", { name: "Reservar cita" })).toBeDisabled();
    });

    it("still returns to details when the hold is no longer releasable (404)", async () => {
        server.release = () => fail(404, "Booking not found");
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillByEmail(user);
        await screen.findByRole("heading", { name: "Revisa tu correo" });

        await user.click(screen.getByRole("button", { name: "¿Te equivocaste? Corregir" }));

        expect(await screen.findByRole("heading", { name: "Último paso" })).toBeInTheDocument();
    });

    it("keeps the release token out of the URL and storage", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillByEmail(user);
        await screen.findByRole("heading", { name: "Revisa tu correo" });
        await user.click(screen.getByRole("button", { name: "¿Te equivocaste? Corregir" }));
        await screen.findByRole("heading", { name: "Último paso" });

        expect(window.location.href).not.toContain("release-token-1");
        expect(JSON.stringify(window.history.state)).not.toContain("release-token-1");
        expect(JSON.stringify({ ...window.localStorage, ...window.sessionStorage })).not.toContain("release-token-1");
        for (const [ url ] of fetchMock.mock.calls) expect(String(url)).not.toContain("release-token-1");
    });

    it("shows the provider contact and no \"Ver mis citas\" when selfServe is false", async () => {
        server.provider = { ...baseProvider, selfServe: false, reschedulePolicy: null, phone: "+573001230000", whatsapp: "+573001239999" };
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillByEmail(user);
        await screen.findByRole("heading", { name: "Revisa tu correo" });

        const notice = screen.getByTestId("provider-contact");
        expect(notice).toHaveTextContent("Para cancelar o cambiar tu cita, comunícate directamente con Dra. Ana Pública");
        expect(within(notice).getByRole("link", { name: /Llamar/ })).toHaveAttribute("href", "tel:+573001230000");
        expect(within(notice).getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", "https://wa.me/573001239999");
        expect(screen.queryAllByRole("link", { name: "Ver mis citas" })).toHaveLength(0);
    });

    it("shows nothing for the contact when the provider has no public number, and Ver mis citas with self-serve", async () => {
        const user = userEvent.setup();
        server.provider = { ...baseProvider, selfServe: false, reschedulePolicy: null };
        const first = render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillByEmail(user);
        await screen.findByRole("heading", { name: "Revisa tu correo" });
        expect(screen.queryByTestId("provider-contact")).not.toBeInTheDocument();
        first.unmount();
        window.history.replaceState(null, "");

        server.provider = baseProvider;
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillByEmail(user);
        await screen.findByRole("heading", { name: "Revisa tu correo" });
        expect(screen.getByTestId("booking-pending").querySelector('a[href="/book/dra-ana/appointments"]')).not.toBeNull();
        expect(screen.queryByTestId("provider-contact")).not.toBeInTheDocument();
    });
});
