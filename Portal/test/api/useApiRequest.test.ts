import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useApiRequest } from "@/src/api/base/useApiRequest";

vi.mock("@/src/api/base/fetchWithAuth", () => ({
    fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from "@/src/api/base/fetchWithAuth";
const mockFetch = vi.mocked(fetchWithAuth);

afterEach(() => vi.resetAllMocks());

function makeOkResponse(json: unknown) {
    return { ok: true, json: async () => json } as unknown as Response;
}

describe("useApiRequest", () => {
    it("does not fetch when url is null", () => {
        renderHook(() => useApiRequest<number>(null, undefined, (j) => j as number));
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("maps a failed status to the Spanish fallback, never raw server text", async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 500 } as unknown as Response);

        const { result } = renderHook(() =>
            useApiRequest<number>("/api/x", undefined, (j) => j as number)
        );

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe("Ocurrió un error en el servidor. Inténtalo de nuevo más tarde.");
    });

    it("maps a known server message to its Spanish text", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 409,
            json: async () => ({ error: "Patient limit reached (5000 per provider)" }),
        } as unknown as Response);

        const { result } = renderHook(() =>
            useApiRequest<number>("/api/x", "fallback", (j) => j as number)
        );

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe("Alcanzaste el límite de pacientes de tu cuenta.");
    });

    it("uses the status fallback for an unknown server message", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: async () => ({ error: "Bad input" }),
        } as unknown as Response);

        const { result } = renderHook(() =>
            useApiRequest<number>("/api/x", "fallback", (j) => j as number)
        );

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe("Revisa los datos ingresados e inténtalo de nuevo.");
    });

    it("reports a fetch failure as a connection problem", async () => {
        mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

        const { result } = renderHook(() =>
            useApiRequest<number>("/api/x", "fallback", (j) => j as number)
        );

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe("No pudimos conectar con el servidor. Revisa tu conexión a internet.");
    });

    it("throws from parse on success:false and surfaces the message", async () => {
        mockFetch.mockResolvedValueOnce(makeOkResponse({ success: false }));

        const { result } = renderHook(() =>
            useApiRequest<number>("/api/x", "fallback", () => {
                throw new Error("API returned an error");
            })
        );

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBe("API returned an error");
    });

    it("refetch triggers a new network call", async () => {
        mockFetch
            .mockResolvedValueOnce(makeOkResponse({ success: true, data: 1 }))
            .mockResolvedValueOnce(makeOkResponse({ success: true, data: 2 }));

        const { result } = renderHook(() =>
            useApiRequest<number>("/api/x", undefined, (j) => (j as { data: number }).data)
        );

        await waitFor(() => expect(result.current.data).toBe(1));

        act(() => { void result.current.refetch(); });
        await waitFor(() => expect(result.current.data).toBe(2));
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("refetch resolves with the fresh payload", async () => {
        mockFetch
            .mockResolvedValueOnce(makeOkResponse({ data: 1 }))
            .mockResolvedValueOnce(makeOkResponse({ data: 2 }));
        const { result } = renderHook(() =>
            useApiRequest<number>("/api/x", undefined, (json) => (json as { data: number }).data)
        );
        await waitFor(() => expect(result.current.data).toBe(1));

        let payload: number | undefined;
        await act(async () => { payload = await result.current.refetch(); });
        expect(payload).toBe(2);
    });
});
