import { useState, useCallback } from "react";
import { API_BASE, ApiResponse } from "../types/API";
import { Patient } from "../types/Patient";

export const useCreatePatient = () => {
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    const createPatient = useCallback(async (patientData: Partial<Patient>) => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_BASE}/patients`, {
                method: "POST",
                credentials: 'include',
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
            const errorMessage = err instanceof Error ? err.message : "Failed to create patient";
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { createPatient, loading, error };
};
