import { API_BASE } from "@/src/config/api";
import { MedicalRecord } from "@/src/types/MedicalRecord";
import { useApiQuery } from "@/src/api/base/useApiQuery";

export const useFetchMedicalRecord = (medicalRecordId: string | undefined) => {
    const url = medicalRecordId ? `${API_BASE}/medical-records/${medicalRecordId}` : null;
    const { data: medicalRecord, loading, error, refetch: fetchMedicalRecord } =
        useApiQuery<MedicalRecord>(url, "Failed to load medical record");
    return { medicalRecord, loading, error, fetchMedicalRecord };
};