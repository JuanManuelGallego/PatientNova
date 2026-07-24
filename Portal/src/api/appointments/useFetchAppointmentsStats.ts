import { API_BASE } from "@/src/config/api";
import { AppointmentStats } from "@/src/types/API";
import { useApiQuery } from "@/src/api/base/useApiQuery";

export const useFetchAppointmentsStats = () => {
    const { data: stats, loading, error, refetch: fetchStats } =
        useApiQuery<AppointmentStats>(`${API_BASE}/appointments/stats`, "Failed to load appointment stats");
    return { stats, loading, error, fetchStats };
};