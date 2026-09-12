import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithAuth } from "@/src/api/base/fetchWithAuth";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("fetchWithAuth", () => {
    it.each([ "/terms-of-service", "/privacy-policy" ])(
        "does not redirect when an unauthorized session probe runs on %s",
        async (pathname) => {
            const fetchMock = vi.fn()
                .mockResolvedValueOnce(new Response(null, { status: 401 }))
                .mockResolvedValueOnce(new Response(null, { status: 401 }));
            vi.stubGlobal("fetch", fetchMock);
            window.history.replaceState({}, "", pathname);

            const response = await fetchWithAuth(
                "/api/users/me",
                undefined,
                { redirectOnUnauthorized: false },
            );

            expect(response.status).toBe(401);
            expect(window.location.pathname).toBe(pathname);
        },
    );
});
