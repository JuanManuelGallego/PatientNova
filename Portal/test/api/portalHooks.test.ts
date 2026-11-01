import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePortalSession } from "@/src/api/portal/usePortalSession";
import { usePublicMutation } from "@/src/api/base/useClientMutation";
import { csrfStore } from "@/src/api/base/csrfStore";
import { ApiClientError } from "@/src/api/base/apiClients";

const fetchMock = vi.fn();
const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
    csrfStore.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("usePortalSession", () => {
    it("returns null, not an error, on 401", async () => {
        fetchMock.mockResolvedValue(respond(401, { success: false, error: "Invalid session" }));
        const { result } = renderHook(() => usePortalSession());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.session).toBeNull();
        expect(result.current.error).toBeNull();
        expect(fetchMock.mock.calls[ 0 ][ 1 ].credentials).toBe("include");
    });

    it("keeps the re-issued CSRF token in memory and forgets it on clear", async () => {
        const session = { email: "a@example.com", expiresAt: "2099-01-01T00:00:00.000Z", csrfToken: "tok", providerSlug: "s", consentRequired: true };
        fetchMock.mockResolvedValue(respond(200, { success: true, data: session }));
        const { result } = renderHook(() => usePortalSession());
        await waitFor(() => expect(result.current.session).toEqual(session));
        expect(csrfStore.get()).toBe("tok");
        act(() => result.current.clear());
        expect(result.current.session).toBeNull();
        expect(csrfStore.get()).toBeNull();
    });

    it("reports other failures as a Spanish error", async () => {
        fetchMock.mockResolvedValue(respond(500, { success: false, error: "boom" }));
        const { result } = renderHook(() => usePortalSession());
        await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiClientError));
        expect(result.current.error?.message).toMatch(/error en el servidor/);
        expect(result.current.session).toBeNull();
    });
});

describe("usePublicMutation", () => {
    it("refuses a second call while one is in flight and never sends credentials", async () => {
        let release!: (r: Response) => void;
        fetchMock.mockReturnValue(new Promise<Response>((r) => { release = r; }));
        const { result } = renderHook(() => usePublicMutation<{ challenge: string }>());

        let first!: Promise<{ challenge: string }>;
        act(() => { first = result.current.mutate("/providers/x/otp", { email: "a@example.com" }); });
        await expect(result.current.mutate("/providers/x/otp", {})).rejects.toThrow("Request already in progress");
        await act(async () => { release(respond(202, { success: true, data: { challenge: "c" } })); await first; });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[ 0 ][ 1 ].credentials).toBe("omit");
        expect(result.current.loading).toBe(false);
    });

    it("exposes the Spanish message and rethrows an ApiClientError with the status", async () => {
        fetchMock.mockResolvedValue(respond(429, { success: false, error: "Too many requests" }));
        const { result } = renderHook(() => usePublicMutation());
        let thrown: unknown;
        await act(async () => { thrown = await result.current.mutate("/x").catch((e: unknown) => e); });
        expect(thrown).toBeInstanceOf(ApiClientError);
        expect((thrown as ApiClientError).status).toBe(429);
        expect(result.current.error).toMatch(/Demasiadas solicitudes/);
    });
});
