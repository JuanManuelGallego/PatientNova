import { useState, useCallback, useRef } from "react";
import { fetchWithAuth } from "./fetchWithAuth";
import { toSpanishMessage } from "./errorMessages";
import { ApiClientError, parseEnvelope } from "./apiClients";

/** Same error as the patient-facing clients: Spanish `message`, raw server text in `details`. */
export { ApiClientError as ApiMutationError };

/**
 * Generic hook for data mutations (POST, PATCH, PUT, DELETE).
 * Call `mutate(url, body?)` to execute the request.
 * Prevents double-submission — concurrent calls while loading are ignored.
 */
export function useApiMutation<TOutput = void>(
    method: "POST" | "PATCH" | "PUT" | "DELETE",
    errorMessage = "No pudimos completar la acción. Inténtalo de nuevo."
) {
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const inflight = useRef(false);

    const mutate = useCallback(async (url: string, body?: unknown): Promise<TOutput> => {
        if (inflight.current) throw new Error("Request already in progress");
        inflight.current = true;
        setLoading(true);
        setError(null);
        try {
            const res = await fetchWithAuth(url, {
                method,
                headers: body != null ? { "Content-Type": "application/json" } : undefined,
                body: body != null ? JSON.stringify(body) : undefined,
            });
            return await parseEnvelope<TOutput>(res);
        } catch (err) {
            // Only ApiClientError carries curated Spanish; a fetch TypeError / abort is a connection failure.
            const msg = err instanceof ApiClientError ? err.message
                : err instanceof Error ? toSpanishMessage(0)
                : errorMessage;
            setError(msg);
            throw err;
        } finally {
            inflight.current = false;
            setLoading(false);
        }
    }, [ method, errorMessage ]);

    return { mutate, loading, error };
}
