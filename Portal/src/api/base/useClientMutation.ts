import { useCallback, useRef, useState } from "react";
import { ApiClientError, portalApi, publicApi } from "./apiClients";
import { toSpanishMessage } from "./errorMessages";

type PostClient = { post: <T>(path: string, body?: unknown) => Promise<T> };

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

export function usePublicMutation<TOutput = void>() {
    return useClientMutation<TOutput>(publicApi);
}

export function usePortalMutation<TOutput = void>() {
    return useClientMutation<TOutput>(portalApi);
}
