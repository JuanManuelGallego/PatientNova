import { useState, useCallback } from "react";
import { API_BASE, ApiResponse } from "../types/API";
import { AppointmentType } from "../types/Appointment";
import { fetchWithAuth } from "./fetchWithAuth";

export const useCreateAppointmentType = () => {
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    const createAppointmentType = useCallback(async (data: Partial<AppointmentType>) => {
        setLoading(true); setError(null);
        try {
            const res = await fetchWithAuth(`${API_BASE}/appointment-types`, {
                method: "POST", credentials: 'include',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            const json: ApiResponse = await res.json();
            if (!json.success) throw new Error("API returned an error");
            return json.data as AppointmentType;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to create appointment type";
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { createAppointmentType, loading, error };
};
