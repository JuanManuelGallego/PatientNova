import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicBookingPage } from "@/src/components/PublicBooking/PublicBookingPage";
import { todayFormattedString } from "@/src/utils/TimeUtils";

const TZ = "America/Bogota";
const today = todayFormattedString(TZ);

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

const slots = {
    timezone: TZ,
    slots: [ `${today}T14:00:00.000Z`, `${today}T20:00:00.000Z` ].map((startUtc) => ({ startUtc, endUtc: startUtc })),
};

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

        const morning = await screen.findByRole("group", { name: "Mañana" });
        expect(within(morning).getAllByRole("button")).toHaveLength(1);
        expect(within(screen.getByRole("group", { name: "Tarde" })).getAllByRole("button")).toHaveLength(1);
        expect(screen.getByRole("button", { name: "Reservar" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Semana anterior" })).toBeDisabled();
    });

    it("reloads slots for the chosen type and pages to the next week", async () => {
        routeFetch();
        render(<PublicBookingPage slug="dra-ana" />);
        await screen.findByRole("group", { name: "Mañana" });

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
        await screen.findByRole("group", { name: "Mañana" });
        for (const [ url, init ] of fetchMock.mock.calls) {
            expect(String(url)).toMatch(/\/v1\/public\/providers\/dra-ana/);
            expect((init as RequestInit).credentials).toBe("omit");
        }
    });
});
