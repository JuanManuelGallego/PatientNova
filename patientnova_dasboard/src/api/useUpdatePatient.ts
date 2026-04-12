import { useState, useCallback } from "react";
import { API_BASE, ApiResponse } from "../types/API";
import { Patient } from "../types/Patient";
import { fetchWithAuth } from "./fetchWithAuth";

export const useUpdatePatient = () => {
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    const updatePatient = useCallback(async (patientId: string, patientData: Partial<Patient>) => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetchWithAuth(`${API_BASE}/patients/${patientId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(patientData),
            });

            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }

            const json: ApiResponse = await res.json();

            if (!json.success) {
                throw new Error("API returned an error");
            }

            return json.data as Patient;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to update patient";
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { updatePatient, loading, error };
};
