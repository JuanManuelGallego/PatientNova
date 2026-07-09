import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useApiRequest } from "../../api/useApiRequest";

vi.mock("../../api/fetchWithAuth", () => ({
    fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from "../../api/fetchWithAuth";
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

    it("uses default error message when none provided", async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 500 } as unknown as Response);

        const { result } = renderHook(() =>
            useApiRequest<number>("/api/x", undefined, (j) => j as number)
        );

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toMatch(/Server Error: 500/);
    });

    it("reads error payload from json when present", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: async () => ({ error: "Bad input" }),
        } as unknown as Response);

        const { result } = renderHook(() =>
            useApiRequest<number>("/api/x", "fallback", (j) => j as number)
        );

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toMatch(/Bad input/);
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

        result.current.refetch();
        await waitFor(() => expect(result.current.data).toBe(2));
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
});
