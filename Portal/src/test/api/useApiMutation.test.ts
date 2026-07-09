import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useApiMutation } from "../../api/useApiMutation";

vi.mock("../../api/fetchWithAuth", () => ({
    fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from "../../api/fetchWithAuth";
const mockFetch = vi.mocked(fetchWithAuth);

afterEach(() => vi.resetAllMocks());

function makeOkResponse<T>(data: T) {
    return {
        ok: true,
        json: async () => ({ success: true, data }),
    } as unknown as Response;
}

function makeErrorResponse(status = 500, errorMsg = "Server Error") {
    return {
        ok: false,
        status,
        json: async () => ({ success: false, error: errorMsg }),
    } as unknown as Response;
}

describe("useApiMutation", () => {
    it("starts with loading=false and error=null", () => {
        const { result } = renderHook(() => useApiMutation<{ id: number }>("POST"));
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
    });

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
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: false, error: "Validation failed" }),
        } as unknown as Response);

        const { result } = renderHook(() => useApiMutation<{ id: number }>("PATCH"));

        await act(async () => {
            await expect(result.current.mutate("/api/items/1")).rejects.toThrow();
        });

        expect(result.current.error).toBeTruthy();
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

    it("uses Error.message as error when exception is an Error instance", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        const { result } = renderHook(() => useApiMutation<{ id: number }>("POST", "Fallback message"));

        await act(async () => {
            await expect(result.current.mutate("/api/items")).rejects.toThrow();
        });

        expect(result.current.error).toBe("Network error");
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
