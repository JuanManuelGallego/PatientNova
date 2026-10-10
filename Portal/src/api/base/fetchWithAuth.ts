import { API_BASE } from "@/src/config/api";

let refreshPromise: Promise<boolean> | null = null;

// CSRF token of the current provider login session. The API cookie is not readable from the
// Portal origin, so the token comes from GET /auth/csrf and is sent back as `X-CSRF-Token` on
// unsafe requests. Memory only: never localStorage/cookies; refetched after a reload.
let csrfToken: string | null = null;
let csrfPromise: Promise<string | null> | null = null;

const UNSAFE_METHODS = new Set([ "POST", "PUT", "PATCH", "DELETE" ]);
const CSRF_REJECTION = "Invalid CSRF token";

/** Drop the cached CSRF token; call when the login session changes (login / logout). */
export function clearCsrfToken(): void {
    csrfToken = null;
}

/**
 * Drop-in replacement for fetch() that handles token expiry transparently.
 *
 * Unsafe requests (POST/PUT/PATCH/DELETE) carry the session's `X-CSRF-Token`; a CSRF rejection
 * (stale token after a re-login in another tab) refetches the token and retries once.
 *
 * On a 401 response it will:
 *   1. Call POST /auth/refresh once (deduplicated across concurrent requests)
 *   2. Retry the original request if refresh succeeds
 *   3. Redirect to /login if refresh fails (session fully expired)
 *
 * Session probes can disable the redirect so public pages remain accessible.
 */
export async function fetchWithAuth(
    input: RequestInfo | URL,
    init?: RequestInit,
    options: { redirectOnUnauthorized?: boolean } = {},
): Promise<Response> {
    let res = await send(input, init);

    if (await isCsrfRejection(res)) {
        clearCsrfToken();
        res = await send(input, init);
    }

    if (res.status !== 401) return res;

    if (!refreshPromise) {
        refreshPromise = attemptRefresh().finally(() => {
            refreshPromise = null;
        });
    }

    const refreshed = await refreshPromise;

    if (!refreshed) {
        if (options.redirectOnUnauthorized !== false) {
            if (typeof window !== "undefined" && window.location.pathname !== "/login" && window.location.pathname !== "/") {
                window.location.replace("/login");
            }
        }
        return res;
    }

    return send(input, init);
}

async function send(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const method = (init?.method ?? "GET").toUpperCase();
    if (!UNSAFE_METHODS.has(method)) {
        return fetch(input, { ...init, credentials: "include" });
    }
    const headers = new Headers(init?.headers);
    const token = await getCsrfToken();
    if (token) headers.set("X-CSRF-Token", token);
    return fetch(input, { ...init, headers, credentials: "include" });
}

async function getCsrfToken(): Promise<string | null> {
    if (csrfToken) return csrfToken;
    if (!csrfPromise) {
        csrfPromise = fetchCsrfToken().finally(() => {
            csrfPromise = null;
        });
    }
    return csrfPromise;
}

async function fetchCsrfToken(): Promise<string | null> {
    try {
        const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: "include" });
        if (!res.ok) return null;
        const json = (await res.json()) as { data?: { csrfToken?: unknown } };
        csrfToken = typeof json.data?.csrfToken === "string" ? json.data.csrfToken : null;
        return csrfToken;
    } catch {
        return null;
    }
}

async function isCsrfRejection(res: Response): Promise<boolean> {
    if (res.status !== 403) return false;
    try {
        const json = (await res.clone().json()) as { error?: unknown };
        return json.error === CSRF_REJECTION;
    } catch {
        return false;
    }
}

async function attemptRefresh(): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
            method: "POST",
            credentials: "include",
        });
        return res.ok;
    } catch {
        return false;
    }
}
