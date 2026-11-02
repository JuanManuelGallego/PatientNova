import { useCallback, useEffect, useState } from "react";
import { ApiClientError, portalApi, publicApi } from "./apiClients";
import { toSpanishMessage } from "./errorMessages";

type GetClient = { get: <T>(path: string) => Promise<T> };

interface Result<T> {
    key: string;
    data?: T;
    error?: ApiClientError;
}

function useClientQuery<T>(client: GetClient, path: string | null) {
    const [ attempt, setAttempt ] = useState(0);
    const [ result, setResult ] = useState<Result<T> | null>(null);
    const key = path === null ? null : `${attempt}:${path}`;

    useEffect(() => {
        if (key === null || path === null) return;
        let live = true;
        client.get<T>(path).then(
            (data) => { if (live) setResult({ key, data }); },
            (err: unknown) => {
                if (!live) return;
                setResult({ key, error: err instanceof ApiClientError ? err : new ApiClientError(toSpanishMessage(0), 0) });
            },
        );
        return () => { live = false; };
    }, [ client, key, path ]);

    const current = result?.key === key ? result : null;
    const retry = useCallback(() => setAttempt((n) => n + 1), []);
    return { data: current?.data, error: current?.error ?? null, loading: key !== null && current === null, retry };
}

export function usePublicQuery<T>(path: string | null) {
    return useClientQuery<T>(publicApi, path);
}

/** Credentialed portal reads; a 401 surfaces as `error.status === 401` (the caller decides it means "signed out"). */
export function usePortalQuery<T>(path: string | null) {
    return useClientQuery<T>(portalApi, path);
}
