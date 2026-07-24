import { API_BASE } from "@/src/config/api";
import { PatientStats } from "@/src/types/API";
import { useApiQuery } from "@/src/api/base/useApiQuery";

export const useFetchPatientsStats = () => {
    const { data: stats, loading, error, refetch: fetchStats } =
        useApiQuery<PatientStats>(`${API_BASE}/patients/stats`, "Failed to load patient stats");
    return { stats, loading, error, fetchStats };
};