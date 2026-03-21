import { useState, useCallback, useEffect } from "react";
import { API_BASE, ReminderStats } from "../types/API";

export const useFetchRemindersStats = () => {
    const [ stats, setStats ] = useState<ReminderStats>();
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    const fetchStats = useCallback(
        async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`${API_BASE}/reminders/stats`);
                if (!res.ok) {
                    throw new Error(`Server error: ${res.status}`);
                }

                const json = await res.json();
                if (!json.success) {
                    throw new Error("API returned an error");
                }

                setStats(json.data as ReminderStats);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load reminder stats");
            }
            finally {
                setLoading(false);
            }
        },
        [],
    );
    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 60000); // Poll every 1 minute
        return () => clearInterval(interval);
    }, [ fetchStats ]);
    return { stats, loading, error, fetchStats };
};

