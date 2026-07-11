import { API_BASE, PatientStats } from "../types/API";
import { useApiQuery } from "./useApiQuery";

export const useFetchPatientsStats = () => {
    const { data: stats, loading, error, refetch: fetchStats } =
        useApiQuery<PatientStats>(`${API_BASE}/patients/stats`, "Failed to load patient stats");
    return { stats, loading, error, fetchStats };
};