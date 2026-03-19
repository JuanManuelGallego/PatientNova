import { useState, useEffect, useCallback } from "react";
import { API_BASE, ApiPaginatedResponse } from "../types/API";
import { Appointment } from "../types/Appointment";

export const useFetchAppointments = () => {
    const [ appointments, setAppointments ] = useState<Appointment[]>([]);
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    const fetchAppointments = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_BASE}/appointments`);

            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }

            const json: ApiPaginatedResponse = await res.json();

            if (!json.success) {
                throw new Error("API returned an error");
            }

            setAppointments(json.data.data as Appointment[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load appointments");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAppointments();
        const interval = setInterval(fetchAppointments, 60000); // Poll every 1 minute
        return () => clearInterval(interval);
    }, [ fetchAppointments ]);

    return { appointments, loading, error, fetchAppointments };
};
