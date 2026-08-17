import { API_BASE } from "@/src/config/api";
import { Patient } from "@/src/types/Patient";
import { useApiQuery } from "@/src/api/base/useApiQuery";

export const useFetchPatient = (
    patientId: string | undefined | null,
    opts?: { take?: number },
) => {
    const url = patientId
        ? `${API_BASE}/patients/${patientId}${opts?.take ? `?take=${opts.take}` : ""}`
        : null;
    const { data: patient, loading, error, refetch: fetchPatient } =
        useApiQuery<Patient>(url, "Failed to load patient" );

    return { patient, loading, error, fetchPatient };
}
