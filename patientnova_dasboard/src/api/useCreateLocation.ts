import { useState, useCallback } from "react";
import { API_BASE, ApiResponse } from "../types/API";
import { AppointmentLocation } from "../types/Appointment";
import { fetchWithAuth } from "./fetchWithAuth";

export const useCreateLocation = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createLocation = useCallback(async (data: Partial<AppointmentLocation>) => {
        setLoading(true); setError(null);
        try {
            const res = await fetchWithAuth(`${API_BASE}/locations`, {
                method: "POST", credentials: 'include',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            const json: ApiResponse = await res.json();
            if (!json.success) throw new Error("API returned an error");
            return json.data as AppointmentLocation;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to create location";
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { createLocation, loading, error };
};
