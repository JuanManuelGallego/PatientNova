import { useCallback, useEffect, useState } from "react";
import { ApiClientError, publicApi } from "./apiClients";
import { toSpanishMessage } from "./errorMessages";

interface Result<T> {
    key: string;
    data?: T;
    error?: ApiClientError;
}

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
