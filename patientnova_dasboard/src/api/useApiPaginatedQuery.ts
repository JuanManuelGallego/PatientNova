import { useEffect, useCallback, useReducer, useRef } from "react";
import { ApiErrorResponse, ApiPaginatedResponse } from "../types/API";
import { fetchWithAuth } from "./fetchWithAuth";
import { actWrapper } from "antd/es/message";

type State<T> = {
    items: T[];
    total: number;
    totalPages: number;
    loading: boolean;
    error: string | null;
};

type Action<T> =
    | { type: "FETCH_START" }
    | { type: "FETCH_SUCCESS"; payload: { items: T[]; total: number; totalPages: number } }
    | { type: "FETCH_ERROR"; payload: string };

function reducer<T>(state: State<T>, action: Action<T>): State<T> {
    switch (action.type) {
        case "FETCH_START":
            return { ...state, loading: true, error: null };
        case "FETCH_SUCCESS":
            return {
                items: action.payload.items,
                total: action.payload.total,
                totalPages: action.payload.totalPages,
                loading: false,
                error: null,
            };
        case "FETCH_ERROR":
            return { ...state, loading: false, error: action.payload };
    }
}

const initialState = <T>(): State<T> => ({
    items: [],
    total: 0,
    totalPages: 0,
    loading: false,
    error: null,
});

export function useApiPaginatedQuery<T>(
    url: string,
    options?: { pollingIntervalMs?: number; errorMessage?: string }
) {
    const { pollingIntervalMs, errorMessage = "Failed to load data" } = options ?? {};

    const [ state, dispatch ] = useReducer(reducer<T>, undefined, initialState<T>);

    const urlRef = useRef(url);
    const errorMessageRef = useRef(errorMessage);

    useEffect(() => { urlRef.current = url; }, [ url ]);
    useEffect(() => { errorMessageRef.current = errorMessage; }, [ errorMessage ]);

    const fetchData = useCallback(async (signal: AbortSignal) => {
        dispatch({ type: "FETCH_START" });
        try {
            const res = await fetchWithAuth(urlRef.current, { signal });
            if (!res.ok) {
                const json: ApiErrorResponse<T> = await res.json();
                throw new Error(`Server Error: ${json.error}`);
            }
            const json: ApiPaginatedResponse<T> = await res.json();
            if (!json.success) throw new Error("API returned an error");
            if (!signal.aborted) dispatch({
                type: "FETCH_SUCCESS",
                payload: {
                    items: json.data.data,
                    total: json.data.total,
                    totalPages: json.data.totalPages,
                },
            });
        } catch (err) {
            if (signal.aborted) return;
            const message = err instanceof Error ? err.message : errorMessageRef.current;
            dispatch({ type: "FETCH_ERROR", payload: message });
        }
    }, []); // stable — reads latest values via refs

    const refetch = useCallback(() => {
        const controller = new AbortController();
        fetchData(controller.signal);
        return () => controller.abort();
    }, [ fetchData ]);

    useEffect(() => {
        const controller = new AbortController();

        void (async () => {
            await fetchData(controller.signal);
        })();

        if (!pollingIntervalMs) return () => controller.abort();

        const interval = setInterval(() => {
            if (!document.hidden) void fetchData(controller.signal);
        }, pollingIntervalMs);

        return () => {
            controller.abort();
            clearInterval(interval);
        };
    }, [ url, pollingIntervalMs, fetchData ]);

    return { ...state, refetch };
}