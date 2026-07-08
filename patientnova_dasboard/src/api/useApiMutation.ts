import { useState, useCallback, useRef } from "react";
import { ApiErrorResponse, ApiResponse } from "../types/API";
import { fetchWithAuth } from "./fetchWithAuth";

/**
 * Generic hook for data mutations (POST, PATCH, PUT, DELETE).
 * Call `mutate(url, body?)` to execute the request.
 * Prevents double-submission — concurrent calls while loading are ignored.
 */
export function useApiMutation<TOutput = void>(
    method: "POST" | "PATCH" | "PUT" | "DELETE",
    errorMessage = "Operation failed"
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
            if (!res.ok) {
                const json: ApiErrorResponse = await res.json();
                throw new Error(`Server Error: ${json.error}`);
            }
            const json: ApiResponse<TOutput> = await res.json();
            if (!json.success) throw new Error("API returned an error");
            return json.data;
        } catch (err) {
            const msg = err instanceof Error ? err.message : errorMessage;
            setError(msg);
            throw err;
        } finally {
            inflight.current = false;
            setLoading(false);
        }
    }, [ method, errorMessage ]);

    return { mutate, loading, error };
}
