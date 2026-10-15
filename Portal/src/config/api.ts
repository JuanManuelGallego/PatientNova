/**
 * Resolves the API origin. In production a missing NEXT_PUBLIC_API_URL must fail loudly in the
 * browser instead of silently calling localhost (which would leave users on a broken app with no
 * clue). The check is skipped on the server/at build time so `next build` does not need the value;
 * every API call is made from client components, so no server-side request can reach localhost.
 * An empty/blank value counts as missing: the API is always a separate origin (no same-origin
 * `/v1` proxy exists), so a relative base would silently hit the Portal itself.
 */
export function resolveApiHost(
    value: string | undefined,
    nodeEnv: string | undefined,
    isBrowser: boolean,
): string {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
    if (nodeEnv === "production" && isBrowser) {
        throw new Error("NEXT_PUBLIC_API_URL no está configurada. Contacta al administrador del sitio.");
    }
    return "http://localhost:3001";
}

const API_HOST = resolveApiHost(
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NODE_ENV,
    typeof window !== "undefined",
);
export const API_BASE = `${API_HOST}/v1`;
