import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useApiMutation } from "@/src/api/base/useApiMutation";

vi.mock("@/src/api/base/fetchWithAuth", () => ({
    fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from "@/src/api/base/fetchWithAuth";
const mockFetch = vi.mocked(fetchWithAuth);

afterEach(() => vi.resetAllMocks());

function makeOkResponse<T>(data: T) {
    return new Response(JSON.stringify({ success: true, data }), { status: 200 });
}

function makeErrorResponse(status = 500, errorMsg = "Server Error") {
    return new Response(JSON.stringify({ success: false, error: errorMsg }), { status });
}

describe("useApiMutation", () => {
    it("returns data on successful mutation", async () => {
        mockFetch.mockResolvedValueOnce(makeOkResponse({ id: 1 }));

        const { result } = renderHook(() => useApiMutation<{ id: number }>("POST"));

        await act(async () => {
            const data = await result.current.mutate("/api/items", { name: "test" });
            expect(data).toEqual({ id: 1 });
        });

        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(mockFetch).toHaveBeenCalledWith("/api/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "test" }),
        });
    });

    it("sets loading=true during inflight request", async () => {
        let resolveRequest: (v: Response) => void;
        const pendingResponse = new Promise<Response>((r) => { resolveRequest = r; });
        mockFetch.mockReturnValueOnce(pendingResponse);

        const { result } = renderHook(() => useApiMutation<{ id: number }>("POST"));

        act(() => {
            result.current.mutate("/api/items").catch(() => {});
        });

        expect(result.current.loading).toBe(true);

        await act(async () => {
            resolveRequest!(makeOkResponse({ id: 1 }));
        });

        expect(result.current.loading).toBe(false);
    });

    it("sets error on server error response", async () => {
        mockFetch.mockResolvedValueOnce(makeErrorResponse(500, "Internal Server Error"));

        const { result } = renderHook(() => useApiMutation<{ id: number }>("POST"));

        await act(async () => {
            await expect(result.current.mutate("/api/items")).rejects.toThrow();
        });

        expect(result.current.error).toBeTruthy();
        expect(result.current.loading).toBe(false);
    });

    it("sets error when API success is false", async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: "Validation failed" }), { status: 200 }));

        const { result } = renderHook(() => useApiMutation<{ id: number }>("PATCH"));

        await act(async () => {
            await expect(result.current.mutate("/api/items/1")).rejects.toThrow();
        });

        expect(result.current.error).toBe("No pudimos completar la acción. Inténtalo de nuevo.");
    });

    it("maps known server messages to Spanish and keeps the raw text in details", async () => {
        mockFetch.mockResolvedValueOnce(makeErrorResponse(409, 'An appointment type named "Terapia" already exists'));

        const { result } = renderHook(() => useApiMutation<{ id: number }>("POST"));

        await act(async () => {
            await expect(result.current.mutate("/api/items")).rejects.toMatchObject({
                status: 409,
                details: 'An appointment type named "Terapia" already exists',
            });
        });

        expect(result.current.error).toBe("Ya existe un registro con ese nombre. Usa un nombre diferente.");
    });

    it("treats a 204 as success with no data", async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        const { result } = renderHook(() => useApiMutation<void>("DELETE"));

        await act(async () => {
            await expect(result.current.mutate("/api/items/1")).resolves.toBeUndefined();
        });
        expect(result.current.error).toBeNull();
    });

    it("sends request without body for DELETE", async () => {
        mockFetch.mockResolvedValueOnce(makeOkResponse(undefined));

        const { result } = renderHook(() => useApiMutation<void>("DELETE"));

        await act(async () => {
            await result.current.mutate("/api/items/1");
        });

        expect(mockFetch).toHaveBeenCalledWith("/api/items/1", {
            method: "DELETE",
            headers: undefined,
            body: undefined,
        });
    });

    it("sends no body when body is explicitly null", async () => {
        mockFetch.mockResolvedValueOnce(makeOkResponse({ ok: true }));

        const { result } = renderHook(() => useApiMutation<{ ok: boolean }>("POST"));

        await act(async () => {
            await result.current.mutate("/api/items", null);
        });

        expect(mockFetch).toHaveBeenCalledWith("/api/items", {
            method: "POST",
            headers: undefined,
            body: undefined,
        });
    });

    it("prevents double submission while request is inflight", async () => {
        let resolveFirst: (v: Response) => void;
        const firstCall = new Promise<Response>((r) => { resolveFirst = r; });
        mockFetch.mockReturnValueOnce(firstCall);
        mockFetch.mockResolvedValueOnce(makeOkResponse({ id: 2 }));

        const { result } = renderHook(() => useApiMutation<{ id: number }>("POST"));

        const firstPromise = act(async () => {
            result.current.mutate("/api/items").catch(() => {});
        });

        await act(async () => {
            await expect(result.current.mutate("/api/items")).rejects.toThrow("Request already in progress");
        });

        resolveFirst!(makeOkResponse({ id: 1 }));
        await firstPromise;

        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("shows the Spanish connection message for network failures, never the raw error text", async () => {
        mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

        const { result } = renderHook(() => useApiMutation<{ id: number }>("POST", "Fallback message"));

        await act(async () => {
            await expect(result.current.mutate("/api/items")).rejects.toThrow();
        });

        expect(result.current.error).toBe("No pudimos conectar con el servidor. Revisa tu conexión a internet.");
    });

    it("uses fallback message when exception is not an Error", async () => {
        mockFetch.mockRejectedValueOnce("string error");

        const { result } = renderHook(() => useApiMutation<{ id: number }>("POST", "Fallback message"));

        await act(async () => {
            await expect(result.current.mutate("/api/items")).rejects.toThrow();
        });

        expect(result.current.error).toBe("Fallback message");
    });

    it("resets error on new mutation", async () => {
        mockFetch.mockResolvedValueOnce(makeErrorResponse(500));
        mockFetch.mockResolvedValueOnce(makeOkResponse({ id: 1 }));

        const { result } = renderHook(() => useApiMutation<{ id: number }>("POST"));

        await act(async () => {
            await expect(result.current.mutate("/api/items")).rejects.toThrow();
        });
        expect(result.current.error).toBeTruthy();

        await act(async () => {
            await result.current.mutate("/api/items");
        });
        expect(result.current.error).toBeNull();
    });
});
