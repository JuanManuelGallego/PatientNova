import { useCallback, useRef, useState } from "react";
import { ApiClientError, portalApi, publicApi } from "./apiClients";
import { toSpanishMessage } from "./errorMessages";

type PostClient = { post: <T>(path: string, body?: unknown) => Promise<T> };

/**
 * Mutation state for the patient-facing clients (`publicApi`/`portalApi`), same shape as
 * `useApiMutation`: `{ mutate, loading, error }`, and a call made while one is in flight is refused.
 * `error` is the curated Spanish message; the thrown `ApiClientError` carries the status.
 */
function useClientMutation<TOutput>(client: PostClient) {
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const inflight = useRef(false);

    const mutate = useCallback(async (path: string, body?: unknown): Promise<TOutput> => {
        if (inflight.current) throw new Error("Request already in progress");
        inflight.current = true;
        setLoading(true);
        setError(null);
        try {
            return await client.post<TOutput>(path, body);
        } catch (err) {
            const normalized = err instanceof ApiClientError ? err : new ApiClientError(toSpanishMessage(0), 0);
            setError(normalized.message);
            throw normalized;
        } finally {
            inflight.current = false;
            setLoading(false);
        }
    }, [ client ]);

    const reset = useCallback(() => setError(null), []);

    return { mutate, loading, error, reset };
}

/** POST to an anonymous `/v1/public` endpoint (no cookies). */
export function usePublicMutation<TOutput = void>() {
    return useClientMutation<TOutput>(publicApi);
}

/** POST to a `/v1/portal` session endpoint (cookie + `X-CSRF-Token`). */
export function usePortalMutation<TOutput = void>() {
    return useClientMutation<TOutput>(portalApi);
}
