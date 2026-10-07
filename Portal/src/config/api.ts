/**
 * Resolves the API origin. In production a missing NEXT_PUBLIC_API_URL must fail loudly in the
 * browser instead of silently calling localhost (which would leave users on a broken app with no
 * clue). The check is skipped on the server/at build time so `next build` does not need the value.
 */
export function resolveApiHost(
    value: string | undefined,
    nodeEnv: string | undefined,
    isBrowser: boolean,
): string {
    if (value) return value;
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
