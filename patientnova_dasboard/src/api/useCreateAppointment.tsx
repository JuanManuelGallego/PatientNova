import { useState, useCallback } from "react";
import { API_BASE, ApiResponse } from "../types/API";
import { Appointment } from "../types/Appointment";

export const useCreateAppointment = () => {
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    const createAppointment = useCallback(async (appointmentData: Partial<Appointment>) => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_BASE}/appointments`, {
                method: "POST",
                credentials: 'include',
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(appointmentData),
            });

            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }

            const json: ApiResponse = await res.json();

            if (!json.success) {
                throw new Error("API returned an error");
            }

            return json.data as Appointment;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to create appointment";
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { createAppointment, loading, error };
};
