import { API_BASE } from "@/src/config/api";
import { csrfStore } from "./csrfStore";
import { toSpanishMessage } from "./errorMessages";

/**
 * Two API clients for patient-facing pages. Neither refreshes tokens nor redirects to /login
 * (that behavior belongs to `fetchWithAuth`, which is for the provider dashboard only):
 *   - publicApi : anonymous endpoints, `credentials: "omit"` (no cookies ever sent or stored)
 *   - portalApi : patient-session endpoints, `credentials: "include"` + `X-CSRF-Token` on mutations
 */

const TIMEOUT_MS = 15_000;

export class ApiClientError extends Error {
    constructor(
        /** User-facing Spanish message. */
        message: string,
        public readonly status: number,
        /** Raw server message, for logs only; never render it. */
        public readonly details?: string,
    ) {
        super(message);
        this.name = "ApiClientError";
    }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

interface Envelope<T> {
    success: boolean;
    data?: T;
    error?: string;
}

async function request<T>(
    prefix: string,
    path: string,
    method: Method,
    body: unknown,
    credentials: RequestCredentials,
    withCsrf: boolean,
): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers[ "Content-Type" ] = "application/json";
    if (withCsrf && method !== "GET") {
        const csrf = csrfStore.get();
        if (csrf) headers[ "X-CSRF-Token" ] = csrf;
    }

    let res: Response;
    try {
        res = await fetch(`${API_BASE}${prefix}${path}`, {
            method,
            headers,
            credentials,
            ...(body !== undefined && { body: JSON.stringify(body) }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } catch {
        throw new ApiClientError(toSpanishMessage(0), 0);
    }

    if (res.status === 204) return undefined as T;

    let json: Envelope<T> | undefined;
    try {
        json = (await res.json()) as Envelope<T>;
    } catch {
        json = undefined;
    }

    if (!res.ok || !json?.success) {
        if (res.status === 401 && withCsrf) csrfStore.clear();
        throw new ApiClientError(toSpanishMessage(res.status, json?.error), res.status, json?.error);
    }

    // Session-creating responses carry the CSRF token; keep it in memory only.
    const maybeToken = (json.data as { csrfToken?: unknown } | undefined)?.csrfToken;
    if (withCsrf && typeof maybeToken === "string") csrfStore.set(maybeToken);

    return json.data as T;
}

export const publicApi = {
    get: <T>(path: string) => request<T>("/public", path, "GET", undefined, "omit", false),
    post: <T>(path: string, body?: unknown) => request<T>("/public", path, "POST", body ?? {}, "omit", false),
};

export const portalApi = {
    get: <T>(path: string) => request<T>("/portal", path, "GET", undefined, "include", true),
    post: <T>(path: string, body?: unknown) => request<T>("/portal", path, "POST", body ?? {}, "include", true),
    patch: <T>(path: string, body: unknown) => request<T>("/portal", path, "PATCH", body, "include", true),
    delete: <T>(path: string) => request<T>("/portal", path, "DELETE", undefined, "include", true),
};
