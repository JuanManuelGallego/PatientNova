import { useState, useCallback } from "react";
import { API_BASE, ApiResponse } from "../types/API";
import { fetchWithAuth } from "./fetchWithAuth";

export const useDeleteAppointmentType = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const deleteAppointmentType = useCallback(async (id: string) => {
        setLoading(true); setError(null);
        try {
            const res = await fetchWithAuth(`${API_BASE}/appointment-types/${id}`, {
                method: "DELETE", credentials: 'include',
            });
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            const json: ApiResponse = await res.json();
            if (!json.success) throw new Error("API returned an error");
            return true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to delete appointment type";
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { deleteAppointmentType, loading, error };
};
