import { useState, useEffect, useCallback } from "react";
import { API_BASE, ApiResponse } from "../types/API";
import { AppointmentType } from "../types/Appointment";
import { fetchWithAuth } from "./fetchWithAuth";

export const useFetchAppointmentTypes = () => {
    const [ appointmentTypes, setAppointmentTypes ] = useState<AppointmentType[]>([]);
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    const fetchAppointmentTypes = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await fetchWithAuth(`${API_BASE}/appointment-types`, { credentials: 'include' });
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            const json: ApiResponse = await res.json();
            if (!json.success) throw new Error("API returned an error");
            setAppointmentTypes(json.data as AppointmentType[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load appointment types");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAppointmentTypes(); }, [ fetchAppointmentTypes ]);
    return { appointmentTypes, loading, error, fetchAppointmentTypes };
};
