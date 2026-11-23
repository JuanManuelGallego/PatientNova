import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuthContext } from "@/src/providers/AuthContext";

const clearAppCaches = vi.fn().mockResolvedValue(undefined);
vi.mock("@/src/utils/appCaches", () => ({ clearAppCaches: () => clearAppCaches() }));

const fetchWithAuth = vi.fn();
vi.mock("@/src/api/base/fetchWithAuth", () => ({
  fetchWithAuth: (...a: unknown[]) => fetchWithAuth(...a),
  clearCsrfToken: vi.fn(),
}));

beforeEach(() => {
  clearAppCaches.mockClear();
  fetchWithAuth.mockReset();
  fetchWithAuth.mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 401 }));
});

describe("logout", () => {
  it("clears app caches even when the logout request rejects", async () => {
    const { result } = renderHook(() => useAuthContext(), { wrapper: AuthProvider });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    fetchWithAuth.mockRejectedValue(new Error("network"));
    await act(async () => { await result.current.logout().catch(() => undefined); });
    expect(clearAppCaches).toHaveBeenCalled();
  });
});
