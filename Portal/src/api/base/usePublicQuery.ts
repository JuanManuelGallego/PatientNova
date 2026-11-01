import { useCallback, useEffect, useState } from "react";
import { ApiClientError, publicApi } from "./apiClients";
import { toSpanishMessage } from "./errorMessages";

interface Result<T> {
    key: string;
    data?: T;
    error?: ApiClientError;
}

/**
 * GET through the anonymous `publicApi` (no cookies, no refresh, no /login redirect), for patient-facing
 * pages; `useApiQuery` always goes through `fetchWithAuth`. A response is kept only for the path (and
 * retry) that asked for it, so switching weeks or types never shows a stale result.
 */
export function usePublicQuery<T>(path: string | null) {
    const [ attempt, setAttempt ] = useState(0);
    const [ result, setResult ] = useState<Result<T> | null>(null);
    const key = path === null ? null : `${attempt}:${path}`;

    useEffect(() => {
        if (key === null || path === null) return;
        let live = true;
        publicApi.get<T>(path).then(
            (data) => { if (live) setResult({ key, data }); },
            (err: unknown) => {
                if (!live) return;
                setResult({ key, error: err instanceof ApiClientError ? err : new ApiClientError(toSpanishMessage(0), 0) });
            },
        );
        return () => { live = false; };
    }, [ key, path ]);

    const current = result?.key === key ? result : null;
    const retry = useCallback(() => setAttempt((n) => n + 1), []);
    return { data: current?.data, error: current?.error ?? null, loading: key !== null && current === null, retry };
}
