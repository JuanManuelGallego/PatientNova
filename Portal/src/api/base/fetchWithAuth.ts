import { API_BASE } from "@/src/config/api";

let refreshPromise: Promise<boolean> | null = null;

let csrfToken: string | null = null;
let csrfPromise: Promise<string | null> | null = null;
let csrfGeneration = 0;

const UNSAFE_METHODS = new Set([ "POST", "PUT", "PATCH", "DELETE" ]);
const CSRF_REJECTION = "Invalid CSRF token";

export function clearCsrfToken(): void {
    csrfToken = null;
    csrfPromise = null;
    csrfGeneration++;
}

export async function fetchWithAuth(
    input: RequestInfo | URL,
    init?: RequestInit,
    options: { redirectOnUnauthorized?: boolean } = {},
): Promise<Response> {
    const res = await sendWithCsrfRetry(input, init);

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

    return sendWithCsrfRetry(input, init);
}

async function sendWithCsrfRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const res = await send(input, init);
    if (!(await isCsrfRejection(res))) return res;
    clearCsrfToken();
    return send(input, init);
}

async function send(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = input instanceof Request ? input : undefined;
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    if (!UNSAFE_METHODS.has(method)) {
        return fetch(input, { ...init, credentials: "include" });
    }
    const headers = new Headers(init?.headers ?? request?.headers);
    const token = await getCsrfToken();
    if (token) headers.set("X-CSRF-Token", token);
    return fetch(input, { ...init, headers, credentials: "include" });
}

async function getCsrfToken(): Promise<string | null> {
    if (csrfToken) return csrfToken;
    if (!csrfPromise) {
        const promise: Promise<string | null> = fetchCsrfToken().finally(() => {
            if (csrfPromise === promise) csrfPromise = null;
        });
        csrfPromise = promise;
    }
    return csrfPromise;
}

async function fetchCsrfToken(): Promise<string | null> {
    const generation = csrfGeneration;
    try {
        const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: "include" });
        if (!res.ok) return null;
        const json = (await res.json()) as { data?: { csrfToken?: unknown } };
        const token = typeof json.data?.csrfToken === "string" ? json.data.csrfToken : null;
        if (generation !== csrfGeneration) return null;
        csrfToken = token;
        return token;
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
        if (res.ok) clearCsrfToken();
        return res.ok;
    } catch {
        return false;
    }
}
