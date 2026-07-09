import { API_BASE } from "../types/API";

let refreshPromise: Promise<boolean> | null = null;

/**
 * Drop-in replacement for fetch() that handles token expiry transparently.
 *
 * On a 401 response it will:
 *   1. Call POST /auth/refresh once (deduplicated across concurrent requests)
 *   2. Retry the original request if refresh succeeds
 *   3. Redirect to /login if refresh fails (session fully expired)
 */
export async function fetchWithAuth(
    input: RequestInfo | URL,
    init?: RequestInit,
): Promise<Response> {
    const res = await fetch(input, { ...init, credentials: "include" });

    if (res.status !== 401) return res;

    if (!refreshPromise) {
        refreshPromise = attemptRefresh().finally(() => {
            refreshPromise = null;
        });
    }

    const refreshed = await refreshPromise;

    if (!refreshed) {
        if (typeof window !== "undefined" && window.location.pathname !== "/login" && window.location.pathname !== "/") {
            window.location.replace("/login");
        }
        return res;
    }

    return fetch(input, { ...init, credentials: "include" });
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
