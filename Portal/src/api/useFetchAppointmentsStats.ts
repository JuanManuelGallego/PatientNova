import { API_BASE, AppointmentStats } from "../types/API";
import { useApiQuery } from "./useApiQuery";

export const useFetchAppointmentsStats = () => {
    const { data: stats, loading, error, refetch: fetchStats } =
        useApiQuery<AppointmentStats>(`${API_BASE}/appointments/stats`, "Failed to load appointment stats");
    return { stats, loading, error, fetchStats };
};