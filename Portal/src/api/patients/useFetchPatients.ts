import { useMemo } from "react";
import { API_BASE } from "@/src/config/api";
import { FetchPatientsFilters, Patient } from "@/src/types/Patient";
import { buildPatientQueryString } from "@/src/utils/ApiUtils";
import { useApiPaginatedQuery } from "@/src/api/base/useApiPaginatedQuery";

export const useFetchPatients = (filters?: FetchPatientsFilters) => {
    const url = useMemo(
        () => `${API_BASE}/patients${buildPatientQueryString(filters)}`,
        [ filters ]
    );
    const { items: patients, loading, error, refetch: fetchPatients, total, totalPages } =
        useApiPaginatedQuery<Patient>(url,"Failed to load patients");

    return { patients, loading, error, fetchPatients, total, totalPages };
}