import { useState, useCallback } from "react";
import { API_BASE } from "../types/API";
import { fetchWithAuth } from "./fetchWithAuth";

export const useDeletePatient = () => {
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    const deletePatient = useCallback(async (patientId: string) => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetchWithAuth(`${API_BASE}/patients/${patientId}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }

            const json = await res.json();

            if (!json.success) {
                throw new Error("API returned an error");
            }

            return true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to delete patient";
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { deletePatient, loading, error };
};
