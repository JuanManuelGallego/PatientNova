import { useCallback, useEffect, useState } from "react";
import { ApiClientError, portalApi } from "@/src/api/base/apiClients";
import { csrfStore } from "@/src/api/base/csrfStore";
import { toSpanishMessage } from "@/src/api/base/errorMessages";
import type { PortalSession } from "@/src/types/PortalSession";

interface State {
    loading: boolean;
    session: PortalSession | null;
    error: ApiClientError | null;
}

export function usePortalSession() {
    const [ attempt, setAttempt ] = useState(0);
    const [ state, setState ] = useState<State>({ loading: true, session: null, error: null });

    useEffect(() => {
        let live = true;
        portalApi.get<PortalSession>("/session").then(
            (session) => { if (live) setState({ loading: false, session, error: null }); },
            (err: unknown) => {
                if (!live) return;
                if (err instanceof ApiClientError && err.status === 401) {
                    setState({ loading: false, session: null, error: null });
                    return;
                }
                const error = err instanceof ApiClientError ? err : new ApiClientError(toSpanishMessage(0), 0);
                setState({ loading: false, session: null, error });
            },
        );
        return () => { live = false; };
    }, [ attempt ]);

    const refetch = useCallback(() => {
        setState((s) => ({ ...s, loading: true, error: null }));
        setAttempt((n) => n + 1);
    }, []);

    const clear = useCallback(() => {
        csrfStore.clear();
        setState({ loading: false, session: null, error: null });
    }, []);

    return { ...state, refetch, clear };
}
