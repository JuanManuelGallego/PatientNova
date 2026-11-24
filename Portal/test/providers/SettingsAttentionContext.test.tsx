import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsAttentionProvider, attentionSections, useSettingsAttention } from "@/src/providers/SettingsAttentionContext";

let role = "ADMIN";
let googleStatus: string | undefined = "expired";
const googleHook = vi.fn();
const bookingHook = vi.fn();
const fetchConnection = vi.fn();
const fetchSettings = vi.fn();

vi.mock("@/src/providers/AuthContext", () => ({ useAuthContext: () => ({ user: { role } }) }));
vi.mock("@/src/api/google/useFetchGoogleConnection", () => ({
    useFetchGoogleConnection: (enabled: boolean) => {
        googleHook(enabled);
        return { data: enabled && googleStatus ? { status: googleStatus } : undefined, loading: false, error: null, fetchConnection };
    },
}));
vi.mock("@/src/api/booking/useFetchBookingSettings", () => ({
    useFetchBookingSettings: (enabled: boolean) => {
        bookingHook(enabled);
        return { settings: enabled ? { bookingEnabled: false, live: false } : undefined, loading: false, error: null, fetchSettings };
    },
}));

beforeEach(() => {
    role = "ADMIN";
    googleStatus = "expired";
    googleHook.mockReset();
    bookingHook.mockReset();
    fetchConnection.mockReset();
    fetchSettings.mockReset();
});

function Probe() {
    const attention = useSettingsAttention();
    return (
        <>
            <div data-testid="sections">{[ ...attention.sections ].sort().join(",")}</div>
            <button onClick={() => attention.report({ integrations: false, booking: true })}>report</button>
            <button onClick={() => attention.refresh()}>refresh</button>
        </>
    );
}
const renderProvider = () => render(<SettingsAttentionProvider><Probe /></SettingsAttentionProvider>);

describe("attentionSections", () => {
    it("flags an expired Google connection but not one never made", () => {
        expect([ ...attentionSections({ googleStatus: "expired" }) ]).toEqual([ "integrations" ]);
        expect(attentionSections({ googleStatus: "not_connected" }).size).toBe(0);
        expect(attentionSections({ googleStatus: "connected" }).size).toBe(0);
    });

    it("flags booking that is on but not live", () => {
        expect([ ...attentionSections({ booking: { bookingEnabled: true, live: false } }) ]).toEqual([ "booking" ]);
        expect(attentionSections({ booking: { bookingEnabled: true, live: true } }).size).toBe(0);
        expect(attentionSections({ booking: { bookingEnabled: false, live: false } }).size).toBe(0);
    });
});

describe("SettingsAttentionProvider", () => {
    it("reports an expired Google connection for an admin", () => {
        renderProvider();
        expect(screen.getByTestId("sections")).toHaveTextContent("integrations");
    });

    it("fetches nothing for a viewer", () => {
        role = "VIEWER";
        renderProvider();
        expect(googleHook).toHaveBeenCalledWith(false);
        expect(bookingHook).toHaveBeenCalledWith(false);
        expect(screen.getByTestId("sections")).toBeEmptyDOMElement();
    });

    it("lets a page clear or raise a section without a reload", () => {
        renderProvider();
        act(() => screen.getByRole("button", { name: "report" }).click());
        expect(screen.getByTestId("sections")).toHaveTextContent(/^booking$/);
    });

    it("refreshes from the server after a fix made elsewhere, dropping page reports", () => {
        renderProvider();
        act(() => screen.getByRole("button", { name: "report" }).click());
        act(() => screen.getByRole("button", { name: "refresh" }).click());

        expect(fetchConnection).toHaveBeenCalledTimes(1);
        expect(fetchSettings).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("sections")).toHaveTextContent(/^integrations$/);
    });
});
