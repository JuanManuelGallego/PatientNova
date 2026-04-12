import { useState, useEffect, useCallback } from "react";
import { API_BASE, ApiPaginatedResponse } from "../types/API";
import { Appointment, FetchAppointmentsFilters } from "../types/Appointment";
import { buildAppointmentQueryString } from "../utils/ApiUtils";
import { fetchWithAuth } from "./fetchWithAuth";

export const useFetchAppointments = (filters?: FetchAppointmentsFilters) => {
    const [ appointments, setAppointments ] = useState<Appointment[]>([]);
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const [ total, setTotal ] = useState(0);
    const [ totalPages, setTotalPages ] = useState(0);

    const fetchAppointments = useCallback(async () => {
        setLoading(true); setError(null);

        try {
            const query = buildAppointmentQueryString(filters);
            const res = await fetchWithAuth(`${API_BASE}/appointments${query}`);

            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }

            const json: ApiPaginatedResponse = await res.json();

            if (!json.success) {
                throw new Error("API returned an error");
            }

            setAppointments(json.data.data as Appointment[]);
            setTotal(json.data.total);
            setTotalPages(json.data.totalPages);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load appointments");
        } finally {
            setLoading(false);
        }
    }, [ filters ]);

    useEffect(() => {
        fetchAppointments();
        const interval = setInterval(fetchAppointments, 300000); // Poll every 5 minutes
        return () => clearInterval(interval);
    }, [ fetchAppointments ]);

    return { appointments, loading, error, fetchAppointments, total, totalPages };
};
