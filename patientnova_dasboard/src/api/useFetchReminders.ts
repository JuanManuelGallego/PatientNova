import { useState, useEffect, useCallback } from "react";
import { API_BASE, ApiPaginatedResponse } from "../types/API";
import { FetchRemindersFilters, Reminder } from "../types/Reminder";
import { buildReminderQueryString } from "../utils/ApiUtils";
import { fetchWithAuth } from "./fetchWithAuth";

export const useFetchReminders = (filters?: FetchRemindersFilters) => {
    const [ reminders, setReminders ] = useState<Reminder[]>([]);
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const [ total, setTotal ] = useState(0);
    const [ totalPages, setTotalPages ] = useState(0);

    const fetchReminders = useCallback(async () => {
        setLoading(true); setError(null);

        try {
            const queryString = buildReminderQueryString(filters);
            const res = await fetchWithAuth(`${API_BASE}/reminders${queryString}`);

            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }

            const json: ApiPaginatedResponse = await res.json();

            if (!json.success) {
                throw new Error("API returned an error");
            }

            setReminders(json.data.data as Reminder[]);
            setTotal(json.data.total);
            setTotalPages(json.data.totalPages);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load reminders");
        } finally {
            setLoading(false);
        }
    }, [ filters ]);

    useEffect(() => {
        fetchReminders();
        const interval = setInterval(fetchReminders, 60000); // Poll every 1 minute
        return () => clearInterval(interval);
    }, [ fetchReminders ]);

    return { reminders, loading, error, fetchReminders, total, totalPages };
};
