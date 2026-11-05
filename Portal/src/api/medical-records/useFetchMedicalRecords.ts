import { useMemo } from "react";
import { API_BASE } from "@/src/config/api";
import { MedicalRecord, FetchMedicalRecordFilters } from "@/src/types/MedicalRecord";
import { useApiPaginatedQuery } from "@/src/api/base/useApiPaginatedQuery";
import { buildMedicalRecordQueryString } from "@/src/utils/ApiUtils";

export const useFetchMedicalRecords = (filters?: FetchMedicalRecordFilters | null) => {
    const url = useMemo(
        () => filters === null ? null : `${API_BASE}/medical-records${buildMedicalRecordQueryString(filters)}`,
        [ filters ]
    );

    const { items: medicalRecords, loading, error, refetch: fetchMedicalRecords, total, totalPages } =
        useApiPaginatedQuery<MedicalRecord>(url, "Failed to load medical record");

    return { medicalRecords, loading, error, fetchMedicalRecords, total, totalPages };
};