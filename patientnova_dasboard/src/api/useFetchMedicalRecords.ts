import { useMemo } from "react";
import { API_BASE } from "../types/API";
import { MedicalRecord, FetchMedicalRecordFilters } from "../types/MedicalRecord";
import { useApiPaginatedQuery } from "./useApiPaginatedQuery";
import { buildMedicalRecordQueryString } from "../utils/ApiUtils";

export const useFetchMedicalRecords = (filters?: FetchMedicalRecordFilters) => {
    const url = useMemo(
        () => `${API_BASE}/medical-records${buildMedicalRecordQueryString(filters)}`,
        [ filters ]
    );

    const { items: medicalRecords, loading, error, refetch: fetchMedicalRecords, total, totalPages } =
        useApiPaginatedQuery<MedicalRecord>(url, { errorMessage: "Failed to load medical record" });

    return { medicalRecords, loading, error, fetchMedicalRecords, total, totalPages };
};