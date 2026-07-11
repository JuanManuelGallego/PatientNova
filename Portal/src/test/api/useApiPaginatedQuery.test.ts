import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useApiPaginatedQuery } from "../../api/useApiPaginatedQuery";

vi.mock("../../api/fetchWithAuth", () => ({
    fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from "../../api/fetchWithAuth";
const mockFetch = vi.mocked(fetchWithAuth);

afterEach(() => vi.resetAllMocks());

function makeOkResponse<T>(data: T[]) {
    return {
        ok: true,
        json: async () => ({
            success: true,
            data: { data, total: data.length, page: 1, pageSize: 10, totalPages: 1 },
        }),
    } as unknown as Response;
}

describe("useApiPaginatedQuery", () => {
    it("starts in loading state then returns items", async () => {
        mockFetch.mockResolvedValueOnce(makeOkResponse([{ id: 1 }, { id: 2 }]));

        const { result } = renderHook(() =>
            useApiPaginatedQuery<{ id: number }>("/api/test")
        );

        expect(result.current.loading).toBe(true);

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.items).toEqual([{ id: 1 }, { id: 2 }]);
        expect(result.current.total).toBe(2);
        expect(result.current.totalPages).toBe(1);
        expect(result.current.error).toBeNull();
    });

    it("sets error when server returns non-ok status without json body", async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 500 } as unknown as Response);

        const { result } = renderHook(() =>
            useApiPaginatedQuery<{ id: number }>("/api/fail")
        );

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toMatch(/500/);
        expect(result.current.items).toEqual([]);
    });

    it("refetch triggers a new network call", async () => {
        mockFetch
            .mockResolvedValueOnce(makeOkResponse([{ id: 1 }]))
            .mockResolvedValueOnce(makeOkResponse([{ id: 2 }]));

        const { result } = renderHook(() =>
            useApiPaginatedQuery<{ id: number }>("/api/items")
        );

        await waitFor(() => expect(result.current.items).toEqual([{ id: 1 }]));

        result.current.refetch();
        await waitFor(() => expect(result.current.items).toEqual([{ id: 2 }]));
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
});
