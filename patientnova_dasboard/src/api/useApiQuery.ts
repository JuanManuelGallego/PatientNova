import { useEffect, useCallback, useReducer, useRef } from "react";
import { ApiErrorResponse, ApiResponse } from "../types/API";
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

export function useApiQuery<T>(
    url: string | null,
    errorMessage?: string
) {
    errorMessage ??= "Failed to load data";

    const [ state, dispatch ] = useReducer(reducer<T>, undefined, initialState<T>);

    const urlRef = useRef(url);
    const errorMessageRef = useRef(errorMessage);

    useEffect(() => { urlRef.current = url; }, [ url ]);
    useEffect(() => { errorMessageRef.current = errorMessage; }, [ errorMessage ]);

    const fetchData = useCallback(async (signal: AbortSignal) => {
        const currentUrl = urlRef.current;
        if (!currentUrl) return;

        dispatch({ type: "FETCH_START" });
        try {
            const res = await fetchWithAuth(currentUrl, { signal });
            if (!res.ok) {
                const json: ApiErrorResponse<T> = await res.json();
                throw new Error(`Server Error: ${json.error}`);
            }
            const json: ApiResponse<T> = await res.json();
            if (!json.success) throw new Error("API returned an error");
            if (!signal.aborted) dispatch({ type: "FETCH_SUCCESS", payload: json.data });
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