import { useState, useCallback } from "react";
import { API_BASE } from "../types/API";
import { Channel, Reminder } from '../types/Reminder';
import { fetchWithAuth } from "./fetchWithAuth";

export const useNotify = () => {
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    const notify = useCallback(async (channel: Channel, payload: Partial<Reminder>) => {
        setLoading(true); setError(null);

        try {
            const res = await fetchWithAuth(`${API_BASE}/notify/${channel.toLowerCase()}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }

            const json = await res.json();

            if (!json.success) {
                throw new Error("API returned an error");
            }

            return json.data as Reminder;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to send notification";
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { notify, loading, error };
};
