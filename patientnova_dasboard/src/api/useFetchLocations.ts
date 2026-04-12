import { useState, useEffect, useCallback } from "react";
import { API_BASE, ApiResponse } from "../types/API";
import { AppointmentLocation } from "../types/Appointment";
import { fetchWithAuth } from "./fetchWithAuth";

export const useFetchLocations = () => {
    const [locations, setLocations] = useState<AppointmentLocation[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchLocations = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await fetchWithAuth(`${API_BASE}/locations`, { credentials: 'include' });
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            const json: ApiResponse = await res.json();
            if (!json.success) throw new Error("API returned an error");
            setLocations(json.data as AppointmentLocation[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load locations");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchLocations(); }, [fetchLocations]);
    return { locations, loading, error, fetchLocations };
};
