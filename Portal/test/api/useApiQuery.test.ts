import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useApiQuery } from "@/src/api/base/useApiQuery";

// Mock fetchWithAuth
vi.mock("@/src/api/base/fetchWithAuth", () => ({
    fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from "@/src/api/base/fetchWithAuth";
const mockFetch = vi.mocked(fetchWithAuth);

afterEach(() => vi.resetAllMocks());

function makeOkResponse<T>(data: T) {
    return {
        ok: true,
        json: async () => ({ success: true, data }),
    } as unknown as Response;
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

    it("sets error when API success is false", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: false }),
        } as unknown as Response);

        const { result } = renderHook(() => useApiQuery<string>("/api/fail"));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBeTruthy();
    });
});
