import { useState, useCallback } from "react";
import { API_BASE } from "../types/API";

export const useDeleteReminder = () => {
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    const deleteReminder = useCallback(async (reminderId: string) => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_BASE}/reminders/${reminderId}`, {
                method: "DELETE",
                credentials: 'include',
            });

            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }

            const json = await res.json();

            if (!json.success) {
                throw new Error("API returned an error");
            }

            return true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to delete reminder";
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { deleteReminder, loading, error };
};
