import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useApiPaginatedQuery } from "@/src/api/base/useApiPaginatedQuery";

vi.mock("@/src/api/base/fetchWithAuth", () => ({
    fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from "@/src/api/base/fetchWithAuth";
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
    it("starts in loading state then returns items with pagination metadata", async () => {
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
});
