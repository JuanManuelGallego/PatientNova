import { useEffect, useCallback, useReducer, useRef } from "react";
import { fetchWithAuth } from "./fetchWithAuth";

type State<T> = {
    data: T | undefined;
    loading: boolean;
    error: string | null;
};

type Action<T> =
    | { type: "FETCH_START" }
    | { type: "FETCH_SUCCESS"; payload: T }
    | { type: "FETCH_ERROR"; payload: string };

function reducer<T>(state: State<T>, action: Action<T>): State<T> {
    switch (action.type) {
        case "FETCH_START":
            return { ...state, loading: true, error: null };
        case "FETCH_SUCCESS":
            return { data: action.payload, loading: false, error: null };
        case "FETCH_ERROR":
            return { ...state, loading: false, error: action.payload };
    }
}

const initialState = <T>(): State<T> => ({
    data: undefined,
    loading: false,
    error: null,
});

/**
 * Core data-fetching hook. Owns the shared lifecycle (reducer, abort handling,
 * refetch, error normalization). Callers supply a `parse` callback that maps the
 * decoded JSON (`R`) to the payload (`T`) and throws on `!success`.
 */
export function useApiRequest<T, R = unknown>(
    url: string | null,
    errorMessage: string | undefined,
    parse: (json: R) => T
) {
    errorMessage ??= "Failed to load data";

    const [ state, dispatch ] = useReducer(reducer<T>, undefined, initialState<T>);

    const urlRef = useRef(url);
    const errorMessageRef = useRef(errorMessage);
    const parseRef = useRef(parse);

    useEffect(() => { urlRef.current = url; }, [ url ]);
    useEffect(() => { errorMessageRef.current = errorMessage; }, [ errorMessage ]);
    useEffect(() => { parseRef.current = parse; }, [ parse ]);

    const fetchData = useCallback(async (signal: AbortSignal) => {
        const currentUrl = urlRef.current;
        if (!currentUrl) return;

        dispatch({ type: "FETCH_START" });
        try {
            const res = await fetchWithAuth(currentUrl, { signal });
            if (!res.ok) {
                let errMsg = `Server Error: ${res.status}`;
                try {
                    if (typeof res.json === "function") {
                        const json = await res.json() as { error?: unknown };
                        if (json && json.error) errMsg = `Server Error: ${String(json.error)}`;
                    }
                } catch {
                    // ignore and keep status-based message
                }
                throw new Error(errMsg);
            }
            const json = await res.json() as R;
            const payload = parseRef.current(json);
            if (!signal.aborted) dispatch({ type: "FETCH_SUCCESS", payload });
        } catch (err) {
            if (signal.aborted) return;
            const message = err instanceof Error ? err.message : errorMessageRef.current;
            dispatch({ type: "FETCH_ERROR", payload: message });
        }
    }, []);

    const refetch = useCallback(() => {
        const controller = new AbortController();
        fetchData(controller.signal);
        return () => controller.abort();
    }, [ fetchData ]);

    useEffect(() => {
        if (!url) return;

        const controller = new AbortController();

        void (async () => {
            await fetchData(controller.signal);
        })();

        return () => controller.abort();
    }, [ url, fetchData ]);

    return { ...state, refetch };
}
