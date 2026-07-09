import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useApiQuery } from "../../api/useApiQuery";

// Mock fetchWithAuth
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

function makeErrorResponse(status = 500) {
    return { ok: false, status } as unknown as Response;
}

describe("useApiQuery", () => {
    it("starts in loading state then returns data", async () => {
        mockFetch.mockResolvedValueOnce(makeOkResponse({ id: 1, name: "Ana" }));

        const { result } = renderHook(() =>
            useApiQuery<{ id: number; name: string }>("/api/test")
        );

        expect(result.current.loading).toBe(true);

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.data).toEqual({ id: 1, name: "Ana" });
        expect(result.current.error).toBeNull();
    });

    it("does not fetch when url is null", () => {
        renderHook(() => useApiQuery<string>(null));
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("sets error when server returns non-ok status", async () => {
        mockFetch.mockResolvedValueOnce(makeErrorResponse(404));

        const { result } = renderHook(() => useApiQuery<string>("/api/missing"));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toMatch(/404/);
        expect(result.current.data).toBeUndefined();
    });

    it("sets error when API success is false", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: false }),
        } as unknown as Response);

        const { result } = renderHook(() => useApiQuery<string>("/api/fail"));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBeTruthy();
    });

    it("refetch triggers a new network call", async () => {
        mockFetch
            .mockResolvedValueOnce(makeOkResponse("first"))
            .mockResolvedValueOnce(makeOkResponse("second"));

        const { result } = renderHook(() => useApiQuery<string>("/api/item"));

        await waitFor(() => expect(result.current.data).toBe("first"));

        result.current.refetch();
        await waitFor(() => expect(result.current.data).toBe("second"));
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
});
