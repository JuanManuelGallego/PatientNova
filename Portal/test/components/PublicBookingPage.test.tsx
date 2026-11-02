import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicBookingPage } from "@/src/components/PublicBooking/PublicBookingPage";
import { todayFormattedString } from "@/src/utils/TimeUtils";
import { addCalendarDays } from "@/src/utils/publicBooking";
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
    hasAvatar: false,
    hasLogo: false,
    timezone: TZ,
    lastBookableDate: "2099-12-31",
    types: [
        { id: "t1", name: "Primera consulta", description: null, durationMinutes: 60, price: 150000 },
        { id: "t2", name: "Control", description: null, durationMinutes: 30, price: null },
    ],
    locations: [ { id: "l1", name: "Consultorio Centro", address: "Calle 10" } ],
};

let slots = {
    timezone: TZ,
    slots: [ `${today}T14:00:00.000Z`, `${today}T20:00:00.000Z` ].map((startUtc) => ({ startUtc, endUtc: startUtc })),
};
const defaultSlots = slots;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const fetchMock = vi.fn();

function routeFetch(profileStatus = 200, slotsStatus = 200) {
    fetchMock.mockImplementation(async (url: string) => {
        if (url.includes("/slots?")) {
            return slotsStatus === 200
                ? json(200, { success: true, data: slots })
                : json(slotsStatus, { success: false, error: "Provider not found" });
        }
        if (profileStatus !== 200) return json(profileStatus, { success: false, error: "Provider not found" });
        return json(200, { success: true, data: provider });
    });
}

beforeEach(() => {
    patientZone.value = TZ;
    slots = defaultSlots;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("PublicBookingPage", () => {
    it("shows the provider, types, locations and today's slots by local morning/afternoon", async () => {
        routeFetch();
        render(<PublicBookingPage slug="dra-ana" />);

        expect(await screen.findByRole("heading", { name: "Dra. Ana Pública" })).toBeInTheDocument();
        expect(screen.getByText("AP")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Primera consulta/ })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByText(/Consultorio Centro/)).toBeInTheDocument();

        const morning = await screen.findByRole("list", { name: "Mañana" });
        expect(within(morning).getAllByRole("listitem")).toHaveLength(1);
        expect(within(screen.getByRole("list", { name: "Tarde" })).getAllByRole("listitem")).toHaveLength(1);
        expect(within(morning).getByRole("button")).toHaveAttribute("aria-pressed", "false");
        expect(screen.queryByText(/Pronto podrás reservar aquí/)).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: /Confirma tu cita/ })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Semana anterior" })).toBeDisabled();
        expect(screen.getByRole("link", { name: "Mis citas" })).toHaveAttribute("href", "/book/dra-ana/appointments");
    });

    it("shows days and times in the patient's zone, not the provider's", async () => {
        patientZone.value = "Asia/Tokyo";
        const tokyoToday = todayFormattedString("Asia/Tokyo");
        const tomorrow = addCalendarDays(tokyoToday, 1);
        slots = {
            timezone: TZ,
            slots: [ `${tomorrow}T01:00:00.000Z`, `${tomorrow}T06:00:00.000Z` ].map((startUtc) => ({ startUtc, endUtc: startUtc })),
        };
        routeFetch();
        render(<PublicBookingPage slug="dra-ana" />);

        const morning = await screen.findByRole("list", { name: "Mañana" });
        expect(morning).toHaveTextContent(/10:00/);
        expect(screen.getByRole("list", { name: "Tarde" })).toHaveTextContent(/03:00/);
        const week = screen.getByRole("group", { name: "Días de la semana" });
        expect(within(week).getAllByRole("button")[ 1 ]).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByText(/Horas en tu zona horaria/)).toHaveTextContent(/Tokio|Tokyo/);

        const url = new URL(String(fetchMock.mock.calls.find(([ u ]) => String(u).includes("/slots?"))![ 0 ]));
        expect(url.searchParams.get("from")).toBe(addCalendarDays(tokyoToday, -2));
        expect(url.searchParams.get("to")).toBe(addCalendarDays(tokyoToday, 8));
    });

    it("shows the whole week, with days without slots greyed out and a tooltip", async () => {
        routeFetch();
        render(<PublicBookingPage slug="dra-ana" />);
        const week = await screen.findByRole("group", { name: "Días de la semana" });
        const days = within(week).getAllByRole("button");
        expect(days).toHaveLength(7);
        expect(days[ 0 ]).not.toHaveAttribute("aria-disabled");
        expect(days[ 0 ]).not.toHaveAttribute("data-tooltip");
        expect(days[ 0 ]).toHaveAttribute("aria-pressed", "true");
        for (const closed of days.slice(1)) {
            expect(closed).toHaveAttribute("aria-disabled", "true");
            expect(closed).toHaveAttribute("data-tooltip", "Sin horarios disponibles");
            expect(closed).toHaveAccessibleName(/sin horarios$/);
        }

        await userEvent.click(days[ 1 ]);
        expect(days[ 0 ]).toHaveAttribute("aria-pressed", "true");
        expect(days[ 1 ]).not.toHaveAttribute("aria-pressed");
    });

    it("offers the next week when this one has no slots", async () => {
        routeFetch();
        render(<PublicBookingPage slug="dra-ana" />);
        await screen.findByRole("list", { name: "Mañana" });
        await userEvent.click(screen.getByRole("button", { name: "Semana siguiente" }));
        expect(await screen.findByText("No hay horarios disponibles esta semana.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Ver la semana siguiente" })).toBeInTheDocument();
    });

    it("reloads slots for the chosen type and pages to the next week", async () => {
        routeFetch();
        render(<PublicBookingPage slug="dra-ana" />);
        await screen.findByRole("list", { name: "Mañana" });

        await userEvent.click(screen.getByRole("button", { name: /Control/ }));
        await waitFor(() => expect(fetchMock.mock.calls.some(([ url ]) => String(url).includes("typeId=t2"))).toBe(true));

        await userEvent.click(screen.getByRole("button", { name: "Semana siguiente" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Semana anterior" })).toBeEnabled());
    });

    it("shows the same unavailable page for any 404", async () => {
        routeFetch(404);
        render(<PublicBookingPage slug="nadie" />);
        expect(await screen.findByText("Esta página de reservas no está disponible")).toBeInTheDocument();
    });

    it("shows the unavailable page when the slots answer 404 (booking turned off meanwhile)", async () => {
        routeFetch(200, 404);
        render(<PublicBookingPage slug="dra-ana" />);
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

    it("only calls the anonymous public API, without credentials", async () => {
        routeFetch();
        render(<PublicBookingPage slug="dra-ana" />);
        await screen.findByRole("list", { name: "Mañana" });
        for (const [ url, init ] of fetchMock.mock.calls) {
            expect(String(url)).toMatch(/\/v1\/public\/providers\/dra-ana/);
            expect((init as RequestInit).credentials).toBe("omit");
        }
    });
});

describe("PublicBookingPage booking", () => {
    const SESSION = {
        email: "ana@example.com",
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
        location: { name: "Consultorio Centro", address: "Calle 10", instructions: "Timbre 2" },
    };

    interface BookServer {
        provider: typeof provider;
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
                return json(200, { success: true, data: { email: SESSION.email, expiresAt: SESSION.expiresAt, csrfToken: "csrf-from-verify" } });
            }
            if (path === "/portal/session") {
                return server.session ? json(200, { success: true, data: server.session }) : json(401, { success: false, error: "Invalid session" });
            }
            if (path === "/portal/bookings") return server.book(JSON.parse(String(init.body)));
            throw new Error(`unexpected ${init.method ?? "GET"} ${path}`);
        });
    });

    async function pickMorningSlot(user: ReturnType<typeof userEvent.setup>) {
        const morning = await screen.findByRole("list", { name: "Mañana" });
        await user.click(within(morning).getByRole("button"));
        return screen.findByRole("heading", { name: /Confirma tu cita/ });
    }

    async function fillDetails(user: ReturnType<typeof userEvent.setup>) {
        await user.type(await screen.findByLabelText("Nombre"), "  Lucía ");
        await user.type(screen.getByLabelText("Apellidos"), "Rojas");
    }

    it("asks for the email first and keeps the chosen time through the login", async () => {
        server.session = null;
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await pickMorningSlot(user);

        expect(screen.getByText(/Primera consulta · 60 minutos/)).toBeInTheDocument();
        expect(screen.getByText(/Consultorio Centro, Calle 10/)).toBeInTheDocument();
        expect(await screen.findByRole("heading", { level: 3, name: "Verifica tu correo" })).toBeInTheDocument();
        expect(screen.getByText(/código para confirmar tu reserva/)).toBeInTheDocument();

        await user.type(screen.getByLabelText("Correo electrónico"), "ana@example.com");
        await user.click(screen.getByRole("button", { name: "Resolver captcha" }));
        await user.click(screen.getByRole("button", { name: "Enviar código" }));
        await user.type(await screen.findByLabelText("Código de 6 dígitos"), "123456");
        await user.click(screen.getByRole("button", { name: "Ingresar" }));

        expect(await screen.findByText("ana@example.com")).toBeInTheDocument();
        expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
        const morning = screen.getByRole("list", { name: "Mañana" });
        expect(within(morning).getByRole("button")).toHaveAttribute("aria-pressed", "true");
    });

    it("books with the typed details and the device zone, then shows the confirmation", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await pickMorningSlot(user);
        await fillDetails(user);
        await user.type(screen.getByLabelText("Teléfono (opcional)"), "+57 300 111 2233");

        const submit = screen.getByRole("button", { name: "Reservar cita" });
        expect(screen.getByRole("link", { name: "Política de privacidad" })).toHaveAttribute("target", "_blank");
        await user.click(screen.getByRole("checkbox"));
        await user.click(submit);

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
        expect(screen.getByRole("link", { name: "Ver mis citas" })).toHaveAttribute("href", "/book/dra-ana/appointments");

        await user.click(screen.getByRole("button", { name: "Reservar otra cita" }));
        expect(await screen.findByRole("list", { name: "Mañana" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: /Confirma tu cita/ })).not.toBeInTheDocument();
    });

    it("needs the country code on the phone and leaves it out when empty", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await pickMorningSlot(user);
        await fillDetails(user);
        await user.click(screen.getByRole("checkbox"));

        const phone = screen.getByLabelText("Teléfono (opcional)");
        await user.type(phone, "3001112233");
        expect(phone).not.toHaveAttribute("aria-invalid");
        await user.tab();
        expect(phone).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByText(/Escríbelo con el indicativo del país/)).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));
        expect(phone).toHaveFocus();
        expect(calls("/portal/bookings")).toHaveLength(0);

        await user.clear(phone);
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));
        await screen.findByRole("heading", { name: "Tu cita quedó reservada" });
        expect(JSON.parse(String(calls("/portal/bookings")[ 0 ][ 1 ].body)).patient).toEqual({ name: "Lucía", lastName: "Rojas" });
    });

    it("clears a taken time, reloads the slots and says why", async () => {
        server.book = () => json(409, { success: false, error: "Slot no longer available" });
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await pickMorningSlot(user);
        const slotFetches = calls("/public/providers/dra-ana/slots").length;
        await fillDetails(user);
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));

        const notice = await screen.findByRole("alert");
        expect(notice).toHaveTextContent("Ese horario ya no está disponible. Elige otro.");
        expect(notice).toHaveFocus();
        expect(screen.queryByRole("heading", { name: /Confirma tu cita/ })).not.toBeInTheDocument();
        await waitFor(() => expect(calls("/public/providers/dra-ana/slots").length).toBe(slotFetches + 1));
    });

    it("keeps the form with the limit and unavailable messages", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await pickMorningSlot(user);
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

    it("goes back to the login with a notice when the session expired", async () => {
        server.book = () => json(401, { success: false, error: "Invalid session" });
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await pickMorningSlot(user);
        await fillDetails(user);
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));

        expect(await screen.findByRole("heading", { name: "Verifica tu correo" })).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("Tu sesión expiró");
    });

    it("lets the patient choose among several locations", async () => {
        server.provider = { ...provider, locations: [ ...provider.locations, { id: "l2", name: "Sede Norte", address: "Calle 100" } ] };
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await pickMorningSlot(user);
        const places = screen.getByRole("group", { name: "Elige el lugar" });
        expect(within(places).getByRole("button", { name: /Consultorio Centro/ })).toHaveAttribute("aria-pressed", "true");
        await user.click(within(places).getByRole("button", { name: /Sede Norte/ }));
        expect(screen.getByText("Sede Norte, Calle 100")).toBeInTheDocument();
        await fillDetails(user);
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));
        await screen.findByRole("heading", { name: "Tu cita quedó reservada" });
        expect(JSON.parse(String(calls("/portal/bookings")[ 0 ][ 1 ].body)).locationId).toBe("l2");
    });

    it("points at each missing field instead of disabling the button", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await pickMorningSlot(user);
        const submit = await screen.findByRole("button", { name: "Reservar cita" });
        expect(submit).toBeEnabled();

        await user.click(submit);
        expect(screen.getByLabelText("Nombre")).toHaveFocus();
        expect(screen.getByLabelText("Nombre")).toHaveAccessibleDescription("Escribe tu nombre.");
        expect(screen.getByText("Escribe tus apellidos.")).toBeInTheDocument();
        expect(screen.getByText("Acepta la política de privacidad para reservar.")).toBeInTheDocument();

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

    it("scrolls the confirmation step into view when a time is picked", async () => {
        const scroll = vi.fn();
        Element.prototype.scrollIntoView = scroll;
        try {
            const user = userEvent.setup();
            render(<PublicBookingPage slug="dra-ana" />);
            const heading = await pickMorningSlot(user);
            expect(scroll).toHaveBeenCalledTimes(1);
            expect(scroll.mock.contexts[ 0 ]).toBe(heading.closest("[role=group]"));
        } finally {
            delete (Element.prototype as Partial<Element>).scrollIntoView;
        }
    });

    it("shows the confirmation with the device zone", async () => {
        const user = userEvent.setup();
        render(<PublicBookingPage slug="dra-ana" />);
        await pickMorningSlot(user);
        await fillDetails(user);
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: "Reservar cita" }));
        const done = (await screen.findByRole("heading", { name: "Tu cita quedó reservada" })).closest("section")!;
        expect(within(done).getByText(/Horas en tu zona horaria/)).toBeInTheDocument();
    });
});
