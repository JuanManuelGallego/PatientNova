import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicBookingPage } from "@/src/components/PublicBooking/PublicBookingPage";
import { todayFormattedString } from "@/src/utils/TimeUtils";
import { addCalendarDays, fmtShortDayTime } from "@/src/utils/publicBooking";
import { csrfStore } from "@/src/api/base/csrfStore";

vi.mock("@/src/components/TurnstileWidget", async () => {
    const { useImperativeHandle } = await import("react");
    return {
        TurnstileWidget: ({ action, onToken, ref }: {
            action: string; onToken: (t: string | null) => void; ref?: React.Ref<{ reset: () => void }>;
        }) => {
            useImperativeHandle(ref, () => ({ reset: () => onToken(null) }), [ onToken ]);
            return <button type="button" onClick={() => onToken(`captcha-${action}`)}>Resolver captcha</button>;
        },
    };
});

const TZ = "America/Bogota";
const today = todayFormattedString(TZ);

const patientZone = vi.hoisted(() => ({ value: "America/Bogota" }));
vi.mock("@/src/utils/TimeUtils", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/src/utils/TimeUtils")>(),
    browserTimezone: () => patientZone.value,
}));

const provider = {
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
    reschedulePolicy: { maxReschedules: 2, minNoticeHours: 24 } as { maxReschedules: number; minNoticeHours: number } | null,
    lastBookableDate: "2099-12-31",
    types: [
        { id: "t1", name: "Primera consulta", description: null, durationMinutes: 60, price: 150000 },
        { id: "t2", name: "Control", description: null, durationMinutes: 30, price: null },
    ],
    locations: [ { id: "l1", name: "Consultorio Centro", address: "Calle 10" as string | null, isVirtual: false } ],
};

let slots = {
    timezone: TZ,
    slots: [ `${today}T14:00:00.000Z`, `${today}T20:00:00.000Z` ].map((startUtc) => ({ startUtc, endUtc: startUtc })),
};
const defaultSlots = slots;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const fetchMock = vi.fn();

function routeFetch(profileStatus = 200, slotsStatus = 200, profile: typeof provider = provider) {
    fetchMock.mockImplementation(async (url: string) => {
        if (url.includes("/slots?")) {
            return slotsStatus === 200
                ? json(200, { success: true, data: slots })
                : json(slotsStatus, { success: false, error: "Provider not found" });
        }
        if (profileStatus !== 200) {
            return json(profileStatus, { success: false, error: profileStatus === 404 ? "Provider not found" : "Internal server error" });
        }
        return json(200, { success: true, data: profile });
    });
}

beforeEach(() => {
    patientZone.value = TZ;
    slots = defaultSlots;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const threeTypes = (extra: Partial<typeof provider> = {}) => ({ ...provider, ...extra });
const twoPlaces = [ ...provider.locations, { id: "l2", name: "Sede Norte", address: "Calle 100" as string | null, isVirtual: false } ];

type User = ReturnType<typeof userEvent.setup>;

async function chooseType(user: User, name: RegExp = /Primera consulta/) {
    await user.click(await screen.findByRole("button", { name }));
}

/** Tu cita, up to the day's times. */
async function toTimes(user: User) {
    await chooseType(user);
    await user.click(screen.getByRole("button", { name: "Ver horarios" }));
    return screen.findByRole("list", { name: "Mañana" });
}

const expectedProgress = (text: string) => expect(screen.getByRole("progressbar", { name: "Progreso de la reserva" })).toHaveAttribute("aria-valuetext", text);

beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});
afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, "");
});

describe("PublicBookingPage", () => {
    it("opens on Tu cita with the provider and no times yet", async () => {
        routeFetch();
        render(<PublicBookingPage slug="dra-ana" />);

        expect(await screen.findByRole("heading", { level: 1, name: "Dra. Ana Pública" })).toBeInTheDocument();
        expect(screen.getByText("AP")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "¿Qué necesitas?" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Mis citas" })).toHaveAttribute("href", "/book/dra-ana/appointments");
        expect(screen.queryByRole("list", { name: "Mañana" })).not.toBeInTheDocument();
        expect(screen.queryByText("Patient Nova")).not.toBeInTheDocument();
        expectedProgress("Paso 1 de 4 · Tu cita");
    });

    it("preselects nothing and keeps Ver horarios disabled until a type is chosen", async () => {
        routeFetch();
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);

        const type = await screen.findByRole("button", { name: /Primera consulta/ });
        expect(type).toHaveAttribute("aria-pressed", "false");
        expect(screen.getByRole("button", { name: "Ver horarios" })).toBeDisabled();

        await user.click(type);
        expect(type).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "Ver horarios" })).toBeEnabled();
    });

    it("asks for the place with the type, and needs both", async () => {
        routeFetch(200, 200, threeTypes({ locations: twoPlaces }));
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);

        await chooseType(user);
        expect(screen.getByRole("heading", { name: "¿Dónde prefieres atenderte?" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Ver horarios" })).toBeDisabled();

        await user.click(screen.getByRole("button", { name: /Sede Norte/ }));
        expect(screen.getByRole("button", { name: "Ver horarios" })).toBeEnabled();
    });

    it("lists each of four places as its own option, with its name and detail", async () => {
        routeFetch(200, 200, threeTypes({
            locations: [
                ...twoPlaces,
                { id: "l3", name: "Sede Sur", address: "Calle 1", isVirtual: false },
                { id: "l4", name: "Sala virtual", address: null, isVirtual: true },
            ],
        }));
        render(<PublicBookingPage slug="dra-ana" />);

        const places = await screen.findByRole("group", { name: "Lugar" });
        expect(within(places).getAllByRole("button")).toHaveLength(4);
        expect(within(places).getByRole("button", { name: /Sala virtual.*Videollamada/ })).toBeInTheDocument();
        expect(within(places).getByRole("button", { name: /Sede Sur.*Calle 1/ })).toBeInTheDocument();
    });

    it("skips Tu cita with one type and one place", async () => {
        routeFetch(200, 200, threeTypes({ types: [ provider.types[ 0 ]! ] }));
        render(<PublicBookingPage slug="dra-ana" />);

        expect(await screen.findByRole("list", { name: "Mañana" })).toBeInTheDocument();
        expectedProgress("Paso 1 de 3 · Horario");
        expect(screen.queryByRole("button", { name: "Atrás" })).not.toBeInTheDocument();
    });

    it("loads the chosen type's times by local morning and afternoon, and Continuar waits for a time", async () => {
        routeFetch();
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);

        const morning = await toTimes(user);
        expect(screen.getByRole("heading", { name: "¿Cuándo te queda bien?" })).toBeInTheDocument();
        expect(within(morning).getAllByRole("listitem")).toHaveLength(1);
        expect(within(screen.getByRole("list", { name: "Tarde" })).getAllByRole("listitem")).toHaveLength(1);
        expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
        expectedProgress("Paso 2 de 4 · Horario");

        await user.click(within(morning).getByRole("button"));
        expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
        expect(fetchMock.mock.calls.some(([ url ]) => String(url).includes("typeId=t1"))).toBe(true);
    });

    it("keeps the choices in the summary", async () => {
        routeFetch();
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);

        const morning = await toTimes(user);
        await user.click(within(morning).getByRole("button"));

        const summary = screen.getByTestId("booking-summary");
        expect(summary).toHaveTextContent(fmtShortDayTime(`${today}T14:00:00.000Z`, TZ));
        expect(summary).toHaveTextContent("Primera consulta · Consultorio Centro · $ 150.000");
    });

    it("shows days and times in the patient's zone, not the provider's", async () => {
        patientZone.value = "Asia/Tokyo";
        const tokyoToday = todayFormattedString("Asia/Tokyo");
        slots = {
            timezone: TZ,
            slots: [ `${tokyoToday}T01:00:00.000Z`, `${tokyoToday}T06:00:00.000Z` ].map((startUtc) => ({ startUtc, endUtc: startUtc })),
        };
        routeFetch();
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);

        const morning = await toTimes(user);
        expect(morning).toHaveTextContent(/10:00/);
        expect(screen.getByRole("list", { name: "Tarde" })).toHaveTextContent(/03:00/);
        expect(screen.getByText(/Horas en tu zona horaria/)).toHaveTextContent(/Tokio|Tokyo/);

        const url = new URL(String(fetchMock.mock.calls.find(([ u ]) => String(u).includes("/slots?"))![ 0 ]));
        expect(url.searchParams.get("from")).toBe(addCalendarDays(tokyoToday, -2));
    });

    it("hides the appointments link when the provider is unavailable", async () => {
        routeFetch(404);
        render(<PublicBookingPage slug="dra-ana" />);

        expect(await screen.findByText("Esta página de reservas no está disponible")).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Mis citas" })).not.toBeInTheDocument();
    });

    it("shows the unavailable page when the slots answer 404 (booking turned off meanwhile)", async () => {
        routeFetch(200, 404);
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);

        await chooseType(user);
        expect(await screen.findByText("Esta página de reservas no está disponible")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    });

    it("offers a retry on server errors", async () => {
        routeFetch(500);
        render(<PublicBookingPage slug="dra-ana" />);
        expect(await screen.findByRole("alert")).toHaveTextContent(/error en el servidor/);
        routeFetch();
        await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
        expect(await screen.findByRole("heading", { name: "Dra. Ana Pública" })).toBeInTheDocument();
    });

    it("stays anonymous until the patient leaves Horario", async () => {
        routeFetch();
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);

        const morning = await toTimes(user);
        await user.click(within(morning).getByRole("button"));
        for (const [ url, init ] of fetchMock.mock.calls) {
            expect(String(url)).toMatch(/\/v1\/public\/providers\/dra-ana/);
            expect((init as RequestInit).credentials).toBe("omit");
        }
    });
});

describe("PublicBookingPage on desktop", () => {
    const profile = threeTypes({ specialty: "Psicología clínica", bio: "Atiendo adultos.", phone: "+573001112222", whatsapp: "+573003334444" });
    const stepCard = (name: string) => screen.getByRole("region", { name }).parentElement!;

    beforeEach(() => {
        vi.stubGlobal("matchMedia", (query: string) => ({
            matches: query === "(min-width: 960px)",
            media: query,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
        }));
    });

    it("has the profile open from the start, with nothing to click", async () => {
        routeFetch(200, 200, profile);
        render(<PublicBookingPage slug="dra-ana" />);

        expect(await screen.findByRole("heading", { level: 1, name: "Dra. Ana Pública" })).toBeInTheDocument();
        expect(screen.getByText("Atiendo adultos.")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/573003334444");
        expect(screen.getByRole("link", { name: "Mis citas" })).toHaveAttribute("href", "/book/dra-ana/appointments");
        expect(screen.queryByRole("button", { name: "Ver perfil" })).not.toBeInTheDocument();
    });

    it("keeps the profile open on later steps, and the name opens no sheet", async () => {
        routeFetch(200, 200, profile);
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toTimes(user);

        expect(screen.getByText("Atiendo adultos.")).toBeInTheDocument();
        expect(screen.getByRole("heading", { level: 1, name: "Dra. Ana Pública" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Dra. Ana Pública" })).not.toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("puts Atrás with the step, from the second step on", async () => {
        routeFetch(200, 200, profile);
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);

        await chooseType(user);
        expect(screen.queryByRole("button", { name: "Atrás" })).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Ver horarios" }));
        const back = within(await screen.findByRole("region", { name: "¿Cuándo te queda bien?" })).getByRole("button", { name: "Atrás" });

        await user.click(back);
        expect(await screen.findByRole("heading", { name: "¿Qué necesitas?" })).toBeInTheDocument();
    });

    it("keeps the summary and the next action in the same card as the step", async () => {
        routeFetch(200, 200, profile);
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await chooseType(user);

        const card = within(stepCard("¿Qué necesitas?"));
        expect(card.getByRole("button", { name: "Ver horarios" })).toBeEnabled();
        expect(card.getByTestId("booking-summary")).toHaveTextContent("Primera consulta");
        expect(card.queryByRole("link", { name: "Mis citas" })).not.toBeInTheDocument();
    });
});

describe("PublicBookingPage provider profile", () => {
    const profile = threeTypes({ specialty: "Psicología clínica", bio: "Atiendo adultos.", phone: "+573001112222", whatsapp: "+573003334444" });

    it("Ver perfil opens the whole profile over the booking, and closing keeps the choice", async () => {
        routeFetch(200, 200, profile);
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await chooseType(user);

        await user.click(screen.getByRole("button", { name: "Ver perfil" }));
        const sheet = screen.getByRole("dialog", { name: "Perfil de Dra. Ana Pública" });
        expect(within(sheet).getByText("Atiendo adultos.")).toBeInTheDocument();
        expect(within(sheet).getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/573003334444");
        expect(within(sheet).getByRole("link", { name: "Ver en el mapa" })).toHaveAttribute("href", expect.stringContaining("query=Calle%2010"));

        await user.click(within(sheet).getByRole("button", { name: "Volver a la reserva" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(screen.getByRole("button", { name: /Primera consulta/ })).toHaveAttribute("aria-pressed", "true");
    });

    it("reads Reservar una cita before any choice", async () => {
        routeFetch(200, 200, profile);
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);

        await user.click(await screen.findByRole("button", { name: "Ver perfil" }));
        expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Reservar una cita" })).toBeInTheDocument();
    });

    it("the back button closes the profile and stays on the step", async () => {
        routeFetch(200, 200, profile);
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toTimes(user);

        await user.click(screen.getByRole("button", { name: "Dra. Ana Pública" }));
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        window.history.back();

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(screen.getByRole("heading", { name: "¿Cuándo te queda bien?" })).toBeInTheDocument();
    });

    it("becomes the page while booking is paused, with no places and no slot request", async () => {
        fetchMock.mockImplementation(async () => json(200, {
            success: true,
            data: { ...provider, bookingOpen: false, types: [], locations: [], bio: "Atiendo adultos.", phone: "+573001112222", reschedulePolicy: null },
        }));
        render(<PublicBookingPage slug="dra-ana" />);

        expect(await screen.findByRole("heading", { name: "Las reservas en línea están en pausa" })).toBeInTheDocument();
        expect(screen.getByTestId("booking-paused")).toBeInTheDocument();
        expect(screen.getByRole("heading", { level: 1, name: "Dra. Ana Pública" })).toBeInTheDocument();
        expect(screen.getByText("Atiendo adultos.")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Llamar al +57 300 111 2222" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Ver mis citas" })).toHaveAttribute("href", "/book/dra-ana/appointments");
        expect(screen.queryByText("Dónde atiende")).not.toBeInTheDocument();
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
        expect(fetchMock.mock.calls.some(([ u ]) => String(u).includes("/slots?"))).toBe(false);
    });
});

describe("PublicBookingPage booking", () => {
    const SESSION = {
        contact: "ana@example.com",
        contactChannel: "EMAIL",
        expiresAt: "2099-01-01T02:00:00.000Z",
        csrfToken: "csrf-from-session",
        providerSlug: "dra-ana",
        consentRequired: true,
    };
    const morningSlot = `${today}T14:00:00.000Z`;
    const booked = {
        id: "a1",
        startUtc: morningSlot,
        endUtc: `${today}T15:00:00.000Z`,
        durationMinutes: 60,
        status: "CONFIRMED",
        price: 150000,
        type: { name: "Primera consulta" },
        location: { name: "Consultorio Centro", address: "Calle 10", instructions: "Timbre 2", isVirtual: false },
        meeting: null,
    };

    interface BookServer {
        provider: typeof provider & { loginChannels?: string[] };
        session: typeof SESSION | null;
        book: (body: unknown) => Response;
    }
    let server: BookServer;

    const calls = (path: string) => fetchMock.mock.calls.filter(([ url ]) => String(url).replace(/^.*\/v1/, "").startsWith(path));

    beforeEach(() => {
        csrfStore.clear();
        server = { provider, session: SESSION, book: () => json(201, { success: true, data: { appointment: booked } }) };
        fetchMock.mockImplementation(async (url: string, init: RequestInit = {}) => {
            const path = String(url).replace(/^.*\/v1/, "");
            if (path.includes("/slots?")) return json(200, { success: true, data: slots });
            if (path === "/public/providers/dra-ana") return json(200, { success: true, data: server.provider });
            if (path === "/public/providers/dra-ana/otp") return json(202, { success: true, data: { challenge: "challenge-1" } });
            if (path === "/portal/dra-ana/otp/verify") {
                server.session = SESSION;
                return json(200, { success: true, data: { contact: SESSION.contact, contactChannel: SESSION.contactChannel, expiresAt: SESSION.expiresAt, csrfToken: "csrf-from-verify" } });
            }
            if (path === "/portal/session") {
                return server.session ? json(200, { success: true, data: server.session }) : json(401, { success: false, error: "Invalid session" });
            }
            if (path === "/portal/bookings") return server.book(JSON.parse(String(init.body)));
            throw new Error(`unexpected ${init.method ?? "GET"} ${path}`);
        });
    });

    /** Through Horario; lands on Tus datos with a session, on verification without one. */
    async function pickMorningSlot(user: User) {
        const morning = await toTimes(user);
        await user.click(within(morning).getByRole("button"));
        await user.click(screen.getByRole("button", { name: "Continuar" }));
    }

    async function toDetails(user: User) {
        await pickMorningSlot(user);
        await screen.findByRole("heading", { name: "Último paso" });
    }

    async function fillDetails(user: User) {
        await user.type(await screen.findByLabelText("Nombre"), "  Lucía ");
        await user.type(screen.getByLabelText("Apellidos"), "Rojas");
    }

    async function sendCode(user: User) {
        await user.type(await screen.findByLabelText("Correo electrónico"), "ana@example.com");
        await user.click(screen.getByRole("button", { name: "Resolver captcha" }));
        await user.click(screen.getByRole("button", { name: "Enviar código" }));
        return screen.findByLabelText("Código de 6 dígitos");
    }

    it("counts verification as a step", async () => {
        server.session = null;
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await pickMorningSlot(user);

        expect(await screen.findByRole("heading", { name: "¿Dónde te enviamos el código?" })).toBeInTheDocument();
        expectedProgress("Paso 3 de 4 · Confirma que eres tú");
    });

    it("says the code was sent only once it was", async () => {
        server.session = null;
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await pickMorningSlot(user);
        await sendCode(user);

        expect(screen.getByRole("heading", { name: "Te enviamos un código" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "¿Dónde te enviamos el código?" })).not.toBeInTheDocument();
    });

    it("drops to three steps when a session already exists", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);

        expectedProgress("Paso 3 de 3 · Tus datos");
    });

    it("treats a session for another provider as none", async () => {
        server.session = { ...SESSION, providerSlug: "otro" };
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await pickMorningSlot(user);

        expect(await screen.findByRole("heading", { name: "¿Dónde te enviamos el código?" })).toBeInTheDocument();
    });

    it("the verify step names who receives the contact, and carries the code lead", async () => {
        server.session = null;
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await pickMorningSlot(user);

        expect(await screen.findByTestId("access-notice")).toHaveTextContent("Al pedir el código solicitas a Consultorio Prueba S.A.S.");
        expect(screen.getByText(/código de 6 dígitos para confirmar tu reserva/)).toBeInTheDocument();
    });

    it("selects email first and offers the provider's login channels", async () => {
        server.session = null;
        server.provider = { ...provider, loginChannels: [ "EMAIL", "WHATSAPP" ] };
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await pickMorningSlot(user);

        const channels = await screen.findByRole("group", { name: "Recibir el código por" });
        expect(within(channels).getByRole("button", { name: "Correo" })).toHaveAttribute("aria-pressed", "true");
    });

    it("keeps the chosen time through the login", async () => {
        server.session = null;
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await pickMorningSlot(user);

        await user.type(await sendCode(user), "123456");

        expect(await screen.findByRole("heading", { name: "Último paso" })).toBeInTheDocument();
        expect(screen.getByText("ana@example.com")).toBeInTheDocument();
        expect(screen.getByTestId("booking-summary")).toHaveTextContent(fmtShortDayTime(morningSlot, TZ));
    });

    it("going back from the code step to Horario and forward sends no new code", async () => {
        server.session = null;
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await pickMorningSlot(user);
        await sendCode(user);

        await user.click(screen.getByRole("button", { name: "Atrás" }));
        await screen.findByRole("heading", { name: "¿Cuándo te queda bien?" });
        await user.click(screen.getByRole("button", { name: "Continuar" }));

        expect(await screen.findByLabelText("Código de 6 dígitos")).toBeInTheDocument();
        expect(calls("/public/providers/dra-ana/otp")).toHaveLength(1);
        expect(screen.getByRole("button", { name: /Reenviar código \(\d+ s\)/ })).toBeDisabled();
    });

    it("the back button walks the steps and keeps every choice", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);

        window.history.back();
        expect(await screen.findByRole("heading", { name: "¿Cuándo te queda bien?" })).toBeInTheDocument();
        expect(within(screen.getByRole("list", { name: "Mañana" })).getByRole("button")).toHaveAttribute("aria-pressed", "true");

        window.history.back();
        expect(await screen.findByRole("heading", { name: "¿Qué necesitas?" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Primera consulta/ })).toHaveAttribute("aria-pressed", "true");
    });

    it("moves focus to each step's heading", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toTimes(user);

        expect(screen.getByRole("heading", { name: "¿Cuándo te queda bien?" })).toHaveFocus();
    });

    it("going back from Tus datos keeps the typed name", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillDetails(user);

        await user.click(screen.getByRole("button", { name: "Atrás" }));
        await user.click(await screen.findByRole("button", { name: "Continuar" }));

        expect(await screen.findByLabelText("Nombre")).toHaveValue("  Lucía ");
    });

    it("changing the type clears the time", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        const morning = await toTimes(user);
        await user.click(within(morning).getByRole("button"));

        await user.click(screen.getByRole("button", { name: "Atrás" }));
        await chooseType(user, /Control/);
        await user.click(screen.getByRole("button", { name: "Ver horarios" }));

        expect(await screen.findByRole("list", { name: "Mañana" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    });

    it("changing only the place keeps the time", async () => {
        server.provider = { ...provider, locations: twoPlaces };
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await chooseType(user);
        await user.click(screen.getByRole("button", { name: /Consultorio Centro/ }));
        await user.click(screen.getByRole("button", { name: "Ver horarios" }));
        await user.click(within(await screen.findByRole("list", { name: "Mañana" })).getByRole("button"));

        await user.click(screen.getByRole("button", { name: "Atrás" }));
        await user.click(await screen.findByRole("button", { name: /Sede Norte/ }));
        await user.click(screen.getByRole("button", { name: "Ver horarios" }));

        expect(await screen.findByRole("button", { name: "Continuar" })).toBeEnabled();
        expect(screen.getByTestId("booking-summary")).toHaveTextContent("Sede Norte");
    });

    it("reloading on a later step restarts at the first step", async () => {
        const user = userEvent.setup();
        const first = render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);

        first.unmount();
        render(<PublicBookingPage slug="dra-ana" />);

        expect(await screen.findByRole("heading", { name: "¿Qué necesitas?" })).toBeInTheDocument();
    });

    it("a stale history entry lands on the furthest valid step, never an empty one", async () => {
        const user = userEvent.setup();
        const first = render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        first.unmount();

        render(<PublicBookingPage slug="dra-ana" />);
        await screen.findByRole("heading", { name: "¿Qué necesitas?" });
        window.history.replaceState({ bookingStep: "details" }, "");
        act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });

        expect(await screen.findByRole("heading", { name: "¿Qué necesitas?" })).toBeInTheDocument();
    });

    it("after booking another, back then a new choice stays on Tu cita until Ver horarios", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillDetails(user);
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));
        await user.click(await screen.findByRole("button", { name: "Reservar otra cita" }));
        await screen.findByRole("heading", { name: "¿Qué necesitas?" });

        window.history.back();
        await new Promise((resolve) => { setTimeout(resolve, 20); });
        await chooseType(user);

        expect(screen.getByRole("heading", { name: "¿Qué necesitas?" })).toBeInTheDocument();
    });

    it("a stale request does not skip Continuar once a time is picked", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        const morning = await toTimes(user);
        window.history.replaceState({ bookingStep: "details" }, "");
        act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });

        await user.click(within(morning).getByRole("button"));

        expect(screen.getByRole("heading", { name: "¿Cuándo te queda bien?" })).toBeInTheDocument();
        expect(calls("/portal/session")).toHaveLength(0);
    });

    it("forward into verification after a reload shows the step, not an empty screen", async () => {
        server.session = null;
        const user = userEvent.setup();
        const first = render(<PublicBookingPage slug="dra-ana" />);
        await toTimes(user);
        first.unmount();

        render(<PublicBookingPage slug="dra-ana" />);
        const morning = await toTimes(user);
        await user.click(within(morning).getByRole("button"));
        window.history.replaceState({ bookingStep: "verify" }, "");
        act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });

        expect(await screen.findByRole("heading", { name: "¿Dónde te enviamos el código?" })).toBeInTheDocument();
    });

    it("a sheet left open before a reload does not come back with later steps", async () => {
        const user = userEvent.setup();
        const first = render(<PublicBookingPage slug="dra-ana" />);
        await user.click(await screen.findByRole("button", { name: "Ver perfil" }));
        first.unmount();

        render(<PublicBookingPage slug="dra-ana" />);
        await toTimes(user);

        expect(window.history.state?.overlay).toBeUndefined();
        window.history.back();
        await screen.findByRole("heading", { name: "¿Qué necesitas?" });
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("closing the profile on the first screen returns focus to Ver perfil and keeps the scroll", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        const open = await screen.findByRole("button", { name: "Ver perfil" });
        await user.click(open);
        vi.mocked(window.scrollTo).mockClear();

        await user.click(screen.getByRole("button", { name: "Reservar una cita" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

        expect(open).toHaveFocus();
        const steppedToTop = vi.mocked(window.scrollTo).mock.calls.filter(([ x, y ]) => x === 0 && y === 0 && window.scrollY !== 0);
        expect(steppedToTop).toHaveLength(0);
        expect(screen.getByRole("heading", { name: "¿Qué necesitas?" })).not.toHaveFocus();
    });

    it("books with the typed details and the device zone, then shows the confirmation", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillDetails(user);
        await user.type(screen.getByLabelText("Teléfono (opcional)"), "+57 300 111 2233");

        expect(screen.getByRole("link", { name: "Política de privacidad" })).toHaveAttribute("target", "_blank");
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));

        expect(await screen.findByRole("heading", { name: "Tu cita quedó reservada" })).toHaveFocus();
        const [ , init ] = calls("/portal/bookings")[ 0 ];
        expect(JSON.parse(String(init.body))).toEqual({
            typeId: "t1",
            locationId: "l1",
            startUtc: morningSlot,
            patientTimezone: TZ,
            consentAccepted: true,
            patient: { name: "Lucía", lastName: "Rojas", phone: "+573001112233" },
        });
        expect(init.credentials).toBe("include");
        expect((init.headers as Record<string, string>)[ "X-CSRF-Token" ]).toBe("csrf-from-session");
        expect(screen.getByText("Timbre 2")).toBeInTheDocument();
        expect(screen.getByText("Confirmada")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Dra. Ana Pública" })).toBeInTheDocument();
        expect(screen.getByText(/Horas en tu zona horaria/)).toBeInTheDocument();
    });

    it("a confirmed booking offers the calendar first, then Ver mis citas and Reservar otra cita", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillDetails(user);
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));
        await screen.findByRole("heading", { name: "Tu cita quedó reservada" });

        const calendar = screen.getByRole("button", { name: "Añadir al calendario" });
        const appointments = screen.getByRole("link", { name: "Ver mis citas" });
        const another = screen.getByRole("button", { name: "Reservar otra cita" });
        expect(calendar.compareDocumentPosition(appointments) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(appointments.compareDocumentPosition(another) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(appointments).toHaveAttribute("href", "/book/dra-ana/appointments");
    });

    it("the result shows Cómo llegar for an in-person place and promises no reminder", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillDetails(user);
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));
        await screen.findByRole("heading", { name: "Tu cita quedó reservada" });

        expect(screen.getByRole("link", { name: "Cómo llegar" })).toHaveAttribute("href", expect.stringContaining("query=Calle%2010"));
        expect(screen.queryByText(/recordar/i)).not.toBeInTheDocument();
    });

    it("the back button after booking keeps the result and books nothing twice", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillDetails(user);
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));
        await screen.findByRole("heading", { name: "Tu cita quedó reservada" });

        window.history.back();
        await new Promise((resolve) => { setTimeout(resolve, 20); });

        expect(screen.getByRole("heading", { name: "Tu cita quedó reservada" })).toBeInTheDocument();
        expect(calls("/portal/bookings")).toHaveLength(1);
    });

    it("Reservar otra cita returns to the first step with nothing chosen and fresh times", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillDetails(user);
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));
        await screen.findByRole("heading", { name: "Tu cita quedó reservada" });

        await user.click(screen.getByRole("button", { name: "Reservar otra cita" }));

        expect(await screen.findByRole("heading", { name: "¿Qué necesitas?" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Primera consulta/ })).toHaveAttribute("aria-pressed", "false");
    });

    it("a phone session shows its number, no phone field and no email field, and sends no phone", async () => {
        server.session = { ...SESSION, contact: "+573001112233", contactChannel: "WHATSAPP" };
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillDetails(user);

        expect(screen.getByText(/Reservarás con el número/)).toBeInTheDocument();
        expect(screen.getByText("+57 300 111 2233")).toBeInTheDocument();
        expect(screen.queryByLabelText("Teléfono (opcional)")).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/correo/i)).not.toBeInTheDocument();

        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));

        await waitFor(() => expect(calls("/portal/bookings")).toHaveLength(1));
        const body = JSON.parse(String(calls("/portal/bookings")[ 0 ][ 1 ].body));
        expect(body.patient).toEqual({ name: "Lucía", lastName: "Rojas" });
    });

    it("in approval mode says so, sends a request and shows the pending screen instead of a confirmation", async () => {
        const request = {
            id: "r1",
            status: "PENDING",
            startUtc: morningSlot,
            endUtc: `${today}T15:00:00.000Z`,
            durationMinutes: 60,
            holdExpiresAt: "2099-01-01T00:00:00.000Z",
            type: { name: "Primera consulta" },
            location: { name: "Consultorio Centro", address: "Calle 10", isVirtual: false },
        };
        server.provider = { ...provider, approvalRequired: true, reschedulePolicy: null };
        server.book = () => json(202, { success: true, data: { request } });
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        expect(await screen.findByTestId("approval-notice")).toHaveTextContent(/confirma cada cita antes de reservarla/);
        await toDetails(user);
        await fillDetails(user);

        expect(screen.queryByTestId("approval-notice")).not.toBeInTheDocument();
        expect(await screen.findByTestId("booking-approval-note")).toHaveTextContent(/mientras Dra\. Ana Pública revisa tu solicitud/);
        expect(screen.getByText(/Enviarás la solicitud con el correo/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Reservar cita" })).not.toBeInTheDocument();
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Enviar solicitud" }));

        expect(await screen.findByRole("heading", { name: "Solicitud enviada" })).toHaveFocus();
        expect(screen.queryByRole("heading", { name: "Tu cita quedó reservada" })).not.toBeInTheDocument();
        expect(within(screen.getByTestId("portal-request-card")).getByText("Pendiente")).toBeInTheDocument();
        expect(screen.getByTestId("request-sent")).toHaveTextContent(/Dra\. Ana Pública la revisará/);
        expect(screen.queryByRole("button", { name: "Añadir al calendario" })).not.toBeInTheDocument();
        expect(screen.getByTestId("portal-request-card")).toHaveTextContent(/Guardamos este horario para ti hasta el/);
        expect(screen.getByRole("link", { name: "Ver mis citas" })).toHaveAttribute("href", "/book/dra-ana/appointments");
        expect(Object.keys(JSON.parse(String(calls("/portal/bookings")[ 0 ][ 1 ].body))).sort()).toEqual([
            "consentAccepted", "locationId", "patient", "patientTimezone", "startUtc", "typeId",
        ]);

        await user.click(screen.getByRole("button", { name: "Enviar otra solicitud" }));
        expect(await screen.findByRole("heading", { name: "¿Qué necesitas?" })).toBeInTheDocument();
    });

    it("validates the phone and leaves it out when empty", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillDetails(user);
        await user.click(screen.getByRole("checkbox"));

        const phone = screen.getByLabelText("Teléfono (opcional)");
        await user.type(phone, "300");
        expect(phone).not.toHaveAttribute("aria-invalid");
        await user.tab();
        expect(phone).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByText(/Revisa el número/)).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));
        expect(phone).toHaveFocus();
        expect(calls("/portal/bookings")).toHaveLength(0);

        await user.clear(phone);
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));
        await screen.findByRole("heading", { name: "Tu cita quedó reservada" });
        expect(JSON.parse(String(calls("/portal/bookings")[ 0 ][ 1 ].body)).patient).toEqual({ name: "Lucía", lastName: "Rojas" });
    });

    it("a taken slot at submit returns to Horario with the message and no time selected", async () => {
        server.book = () => json(409, { success: false, error: "Slot no longer available" });
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        const slotFetches = calls("/public/providers/dra-ana/slots").length;
        await fillDetails(user);
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));

        expect(await screen.findByRole("heading", { name: "¿Cuándo te queda bien?" })).toBeInTheDocument();
        const notice = await screen.findByRole("alert");
        expect(notice).toHaveTextContent("Ese horario ya no está disponible. Elige otro.");
        await waitFor(() => expect(notice).toHaveFocus());
        expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
        await waitFor(() => expect(calls("/public/providers/dra-ana/slots").length).toBeGreaterThan(slotFetches));
    });

    it("keeps the form with the limit and unavailable messages", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillDetails(user);
        await user.click(screen.getByRole("checkbox"));

        server.book = () => json(409, { success: false, error: "Booking limit reached" });
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Ya tienes 3 citas próximas reservadas en línea");

        server.book = () => json(409, { success: false, error: "Online booking unavailable" });
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));
        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Comunícate con el consultorio"));
        expect(screen.getByLabelText("Nombre")).toHaveValue("  Lucía ");
    });

    it("an expired session at submit returns to verification with the notice", async () => {
        server.book = () => json(401, { success: false, error: "Invalid session" });
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillDetails(user);
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));

        expect(await screen.findByRole("heading", { name: "¿Dónde te enviamos el código?" })).toBeInTheDocument();
        expect(await screen.findByLabelText("Correo electrónico")).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("Tu sesión expiró");
    });

    it("books at the chosen place", async () => {
        server.provider = { ...provider, locations: twoPlaces };
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await chooseType(user);
        await user.click(screen.getByRole("button", { name: /Sede Norte/ }));
        await user.click(screen.getByRole("button", { name: "Ver horarios" }));
        await user.click(within(await screen.findByRole("list", { name: "Mañana" })).getByRole("button"));
        await user.click(screen.getByRole("button", { name: "Continuar" }));
        await fillDetails(user);
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));

        await screen.findByRole("heading", { name: "Tu cita quedó reservada" });
        expect(JSON.parse(String(calls("/portal/bookings")[ 0 ][ 1 ].body)).locationId).toBe("l2");
    });

    it("points at each missing field instead of disabling the button", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        const submit = await screen.findByRole("button", { name: "Reservar cita" });
        expect(submit).toBeEnabled();

        await user.click(submit);
        expect(screen.getByLabelText("Nombre")).toHaveFocus();
        expect(screen.getByLabelText("Nombre")).toHaveAccessibleDescription("Escribe tu nombre.");
        expect(screen.getByText("Escribe tus apellidos.")).toBeInTheDocument();
        expect(screen.getByText("Marca la autorización para continuar, o contacta directamente a la clínica.")).toBeInTheDocument();

        await fillDetails(user);
        await user.click(submit);
        expect(screen.getByRole("checkbox")).toHaveFocus();
        expect(screen.queryByText("Escribe tu nombre.")).not.toBeInTheDocument();
        expect(calls("/portal/bookings")).toHaveLength(0);

        await user.click(screen.getByRole("checkbox"));
        expect(screen.queryByText(/Acepta la política/)).not.toBeInTheDocument();
        await user.click(submit);
        await screen.findByRole("heading", { name: "Tu cita quedó reservada" });
    });

    it("states the cancel and reschedule policy before the patient confirms", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        expect(screen.getByTestId("booking-policy")).toHaveTextContent(
            "Puedes cancelarla desde Mis citas en cualquier momento antes de la cita y reprogramarla hasta 2 veces, con al menos 24 horas de anticipación.",
        );
    });

    it("offers the booked appointment as a calendar file named after the provider", async () => {
        const blobs: Blob[] = [];
        URL.createObjectURL = vi.fn((blob: Blob) => { blobs.push(blob); return "blob:ics"; });
        URL.revokeObjectURL = vi.fn();
        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);
        await fillDetails(user);
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));

        await user.click(await screen.findByRole("button", { name: "Añadir al calendario" }));

        expect(click).toHaveBeenCalledOnce();
        const ics = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.readAsText(blobs[ 0 ]!);
        });
        expect(ics).toContain("SUMMARY:Cita con Dra. Ana Pública");
        expect(ics).not.toContain("Lucía");
        click.mockRestore();
    });
});
