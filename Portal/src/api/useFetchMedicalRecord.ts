import { API_BASE } from "../types/API";
import { MedicalRecord } from "../types/MedicalRecord";
import { useApiQuery } from "./useApiQuery";

export const useFetchMedicalRecord = (medicalRecordId: string | undefined) => {
    const url = medicalRecordId ? `${API_BASE}/medical-records/${medicalRecordId}` : null;
    const { data: medicalRecord, loading, error, refetch: fetchMedicalRecord } =
        useApiQuery<MedicalRecord>(url, "Failed to load medical record");
    return { medicalRecord, loading, error, fetchMedicalRecord };
};