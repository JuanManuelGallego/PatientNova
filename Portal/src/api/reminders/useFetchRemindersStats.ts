import { API_BASE } from "@/src/config/api";
import { ReminderStats } from "@/src/types/API";
import { useApiQuery } from "@/src/api/base/useApiQuery";

export const useFetchRemindersStats = () => {
    const { data: stats, loading, error, refetch: fetchStats } =
        useApiQuery<ReminderStats>(`${API_BASE}/reminders/stats`, "Failed to load reminder stats");
    return { stats, loading, error, fetchStats };
};