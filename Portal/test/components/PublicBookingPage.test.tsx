import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicBookingPage } from "@/src/components/PublicBooking/PublicBookingPage";
import { todayFormattedString } from "@/src/utils/TimeUtils";
import { addCalendarDays, fmtShortDayTime } from "@/src/utils/publicBooking";

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
    selfServe: true,
    whatsappConfirmation: true,
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
        expectedProgress("Paso 1 de 3 · Tu cita");
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

    it("shows a single place already chosen next to several types", async () => {
        routeFetch();
        render(<PublicBookingPage slug="dra-ana" />);

        const places = await screen.findByRole("group", { name: "Lugar" });
        expect(within(places).getByRole("button", { name: /Consultorio Centro.*Calle 10/ })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: /Primera consulta/ })).toHaveAttribute("aria-pressed", "false");
        expect(screen.getByRole("heading", { name: "¿Qué necesitas?" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Lugar de atención" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "¿Dónde prefieres atenderte?" })).not.toBeInTheDocument();
    });

    it("shows a single type already chosen next to several places", async () => {
        routeFetch(200, 200, threeTypes({ types: [ provider.types[ 0 ]! ], locations: twoPlaces }));
        render(<PublicBookingPage slug="dra-ana" />);

        const types = await screen.findByRole("group", { name: "Tipo de cita" });
        expect(within(types).getByRole("button", { name: /Primera consulta/ })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "Ver horarios" })).toBeDisabled();
        expect(screen.getByRole("heading", { level: 2, name: "Tu cita" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Tipo de cita" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "¿Dónde prefieres atenderte?" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "¿Qué necesitas?" })).not.toBeInTheDocument();
    });

    it("skips Tu cita with one type and one place", async () => {
        routeFetch(200, 200, threeTypes({ types: [ provider.types[ 0 ]! ] }));
        render(<PublicBookingPage slug="dra-ana" />);

        expect(await screen.findByRole("list", { name: "Mañana" })).toBeInTheDocument();
        expectedProgress("Paso 1 de 2 · Horario");
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
        expectedProgress("Paso 2 de 3 · Horario");

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

    it("shows no Mis citas entry point without self-serve, in the header, the panel or while paused", async () => {
        const noSelfServe = { ...provider, selfServe: false, reschedulePolicy: null };
        routeFetch(200, 200, noSelfServe);
        const { unmount } = render(<PublicBookingPage slug="dra-ana" />);
        await screen.findByRole("heading", { level: 1 });
        expect(screen.queryByRole("link", { name: "Mis citas" })).not.toBeInTheDocument();
        unmount();

        fetchMock.mockImplementation(async () => json(200, { success: true, data: { ...noSelfServe, bookingOpen: false, types: [], locations: [] } }));
        render(<PublicBookingPage slug="dra-ana" />);
        await screen.findByTestId("booking-paused");
        expect(screen.queryByRole("link", { name: "Ver mis citas" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Mis citas" })).not.toBeInTheDocument();
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
    const morningSlot = `${today}T14:00:00.000Z`;
    const pendingDto = {
        channel: "EMAIL",
        contact: "ana@example.com",
        startUtc: morningSlot,
        holdExpiresAt: "2099-01-01T00:00:00.000Z",
        approvalRequired: false,
        releaseToken: "release-token-1",
    };

    beforeEach(() => {
        fetchMock.mockImplementation(async (url: string) => {
            const path = String(url).replace(/^.*\/v1/, "");
            if (path.includes("/slots?")) return json(200, { success: true, data: slots });
            if (path === "/public/providers/dra-ana") return json(200, { success: true, data: provider });
            if (path === "/public/providers/dra-ana/bookings") return json(202, { success: true, data: pendingDto });
            throw new Error(`unexpected ${path}`);
        });
    });

    const calls = (path: string) => fetchMock.mock.calls.filter(([ url ]) => String(url).replace(/^.*\/v1/, "").startsWith(path));

    async function toDetails(user: User) {
        const morning = await toTimes(user);
        await user.click(within(morning).getByRole("button"));
        await user.click(screen.getByRole("button", { name: "Continuar" }));
        await screen.findByRole("heading", { name: "Último paso" });
    }

    async function fillDetails(user: User) {
        await user.type(await screen.findByLabelText("Nombre"), "  Lucía ");
        await user.type(screen.getByLabelText("Apellidos"), "Rojas");
    }

    it("has three steps and no verification: Tus datos comes right after Horario", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);

        expectedProgress("Paso 3 de 3 · Tus datos");
        expect(screen.queryByText(/código/i)).not.toBeInTheDocument();
    });

    it("keeps the chosen time through Tus datos", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);

        expect(screen.getByTestId("booking-summary")).toHaveTextContent(fmtShortDayTime(morningSlot, TZ));
    });

    it("stays anonymous after Horario: every call is public and sends no credentials", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await toDetails(user);

        for (const [ url, init ] of fetchMock.mock.calls) {
            expect(String(url)).toMatch(/\/v1\/public\//);
            expect((init as RequestInit).credentials).toBe("omit");
        }
    });

    it("a stale verification entry lands on Tus datos once a time is picked", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        const morning = await toTimes(user);
        await user.click(within(morning).getByRole("button"));
        window.history.replaceState({ bookingStep: "verify" }, "");
        act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });

        expect(await screen.findByRole("heading", { name: "Último paso" })).toBeInTheDocument();
    });

    it("books at the chosen place", async () => {
        const user = userEvent.setup();
        fetchMock.mockImplementation(async (url: string) => {
            const path = String(url).replace(/^.*\/v1/, "");
            if (path.includes("/slots?")) return json(200, { success: true, data: slots });
            if (path === "/public/providers/dra-ana") return json(200, { success: true, data: { ...provider, locations: twoPlaces } });
            return json(202, { success: true, data: pendingDto });
        });
        render(<PublicBookingPage slug="dra-ana" />);
        await chooseType(user);
        await user.click(screen.getByRole("button", { name: /Sede Norte/ }));
        await user.click(screen.getByRole("button", { name: "Ver horarios" }));
        await user.click(within(await screen.findByRole("list", { name: "Mañana" })).getByRole("button"));
        await user.click(screen.getByRole("button", { name: "Continuar" }));
        await fillDetails(user);
        await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Resolver captcha" }));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));

        await screen.findByRole("heading", { name: "Revisa tu correo" });
        expect(JSON.parse(String(calls("/public/providers/dra-ana/bookings")[ 0 ][ 1 ].body)).locationId).toBe("l2");
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
        routeFetch(200, 200, threeTypes({ locations: twoPlaces }));
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
});
