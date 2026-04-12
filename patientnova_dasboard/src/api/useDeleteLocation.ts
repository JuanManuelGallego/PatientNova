import { useState, useCallback } from "react";
import { API_BASE, ApiResponse } from "../types/API";
import { fetchWithAuth } from "./fetchWithAuth";

export const useDeleteLocation = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const deleteLocation = useCallback(async (id: string) => {
        setLoading(true); setError(null);
        try {
            const res = await fetchWithAuth(`${API_BASE}/locations/${id}`, {
                method: "DELETE", credentials: 'include',
            });
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            const json: ApiResponse = await res.json();
            if (!json.success) throw new Error("API returned an error");
            return true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to delete location";
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { deleteLocation, loading, error };
};
