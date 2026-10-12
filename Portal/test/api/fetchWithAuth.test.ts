import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCsrfToken, fetchWithAuth } from "@/src/api/base/fetchWithAuth";

afterEach(() => {
    vi.unstubAllGlobals();
    clearCsrfToken();
});

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const csrfResponse = (token: string) => json({ success: true, data: { csrfToken: token } });
const sentCsrf = (call: unknown[]) => new Headers((call[1] as RequestInit).headers).get("X-CSRF-Token");

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

describe("fetchWithAuth CSRF", () => {
    it("does not fetch or send a CSRF token on GET", async () => {
        const fetchMock = vi.fn().mockResolvedValue(json({ success: true }));
        vi.stubGlobal("fetch", fetchMock);

        await fetchWithAuth("/api/items");

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(sentCsrf(fetchMock.mock.calls[0]!)).toBeNull();
    });

    it("fetches the token once and sends it on every unsafe request", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(csrfResponse("tok-1"))
            .mockResolvedValue(json({ success: true }));
        vi.stubGlobal("fetch", fetchMock);

        await fetchWithAuth("/api/items", { method: "POST", headers: { "Content-Type": "application/json" } });
        await fetchWithAuth("/api/items/1", { method: "DELETE" });

        expect(fetchMock.mock.calls[0]![0]).toMatch(/\/auth\/csrf$/);
        expect(sentCsrf(fetchMock.mock.calls[1]!)).toBe("tok-1");
        expect(new Headers((fetchMock.mock.calls[1]![1] as RequestInit).headers).get("Content-Type")).toBe("application/json");
        expect(sentCsrf(fetchMock.mock.calls[2]!)).toBe("tok-1");
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("refetches the token and retries once after a CSRF rejection", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(csrfResponse("stale"))
            .mockResolvedValueOnce(json({ success: false, error: "Invalid CSRF token" }, 403))
            .mockResolvedValueOnce(csrfResponse("fresh"))
            .mockResolvedValueOnce(json({ success: true }));
        vi.stubGlobal("fetch", fetchMock);

        const res = await fetchWithAuth("/api/items", { method: "PATCH" });

        expect(res.status).toBe(200);
        expect(sentCsrf(fetchMock.mock.calls[3]!)).toBe("fresh");
    });

    it("does not retry a permission 403", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(csrfResponse("tok"))
            .mockResolvedValueOnce(json({ success: false, error: "Insufficient permissions" }, 403));
        vi.stubGlobal("fetch", fetchMock);

        const res = await fetchWithAuth("/api/items", { method: "POST" });

        expect(res.status).toBe(403);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("refetches the token after a refresh and still retries a CSRF rejection", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(csrfResponse("sid-a"))
            .mockResolvedValueOnce(new Response(null, { status: 401 }))
            .mockResolvedValueOnce(json({ success: true }))
            .mockResolvedValueOnce(csrfResponse("sid-b-stale"))
            .mockResolvedValueOnce(json({ success: false, error: "Invalid CSRF token" }, 403))
            .mockResolvedValueOnce(csrfResponse("sid-b"))
            .mockResolvedValueOnce(json({ success: true }));
        vi.stubGlobal("fetch", fetchMock);

        const res = await fetchWithAuth("/api/items", { method: "POST" });

        expect(res.status).toBe(200);
        expect(fetchMock.mock.calls[2]![0]).toMatch(/\/auth\/refresh$/);
        expect(fetchMock.mock.calls[3]![0]).toMatch(/\/auth\/csrf$/);
        expect(sentCsrf(fetchMock.mock.calls[6]!)).toBe("sid-b");
        expect(fetchMock).toHaveBeenCalledTimes(7);
    });

    it("sends the token for a Request object with an unsafe method", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(csrfResponse("tok"))
            .mockResolvedValue(json({ success: true }));
        vi.stubGlobal("fetch", fetchMock);

        await fetchWithAuth(new Request("http://localhost/api/items/1", { method: "DELETE", headers: { "X-Trace": "1" } }));

        const headers = new Headers((fetchMock.mock.calls[1]![1] as RequestInit).headers);
        expect(headers.get("X-CSRF-Token")).toBe("tok");
        expect(headers.get("X-Trace")).toBe("1");
    });

    it("ignores a token fetch that resolves after the token was cleared", async () => {
        let resolveStale!: (res: Response) => void;
        const fetchMock = vi.fn()
            .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveStale = resolve; }))
            .mockResolvedValueOnce(csrfResponse("new-session"))
            .mockResolvedValue(json({ success: true }));
        vi.stubGlobal("fetch", fetchMock);

        const stale = fetchWithAuth("/api/items", { method: "POST" });
        await Promise.resolve();
        clearCsrfToken();
        await fetchWithAuth("/api/items", { method: "POST" });
        resolveStale(csrfResponse("old-session"));
        await stale;
        await fetchWithAuth("/api/items", { method: "POST" });

        const csrfSent = fetchMock.mock.calls
            .filter((call) => !String(call[0]).endsWith("/auth/csrf"))
            .map(sentCsrf);
        expect(csrfSent.at(-1)).toBe("new-session");
    });
});
