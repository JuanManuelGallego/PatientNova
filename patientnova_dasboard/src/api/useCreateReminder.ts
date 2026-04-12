import { useState, useCallback } from "react";
import { API_BASE, ApiResponse } from "../types/API";
import { Reminder } from "../types/Reminder";
import { fetchWithAuth } from "./fetchWithAuth";

export const useCreateReminder = () => {
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    const createReminder = useCallback(async (reminderData: Partial<Reminder>) => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetchWithAuth(`${API_BASE}/reminders`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(reminderData),
            });

            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }

            const json: ApiResponse = await res.json();

            if (!json.success) {
                throw new Error("API returned an error");
            }

            return json.data as Reminder;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to create reminder";
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { createReminder, loading, error };
};
