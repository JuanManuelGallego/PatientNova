import { useMemo } from "react";
import { API_BASE } from "../types/API";
import { FetchPatientsFilters, Patient } from "../types/Patient";
import { buildPatientQueryString } from "../utils/ApiUtils";
import { useApiPaginatedQuery } from "./useApiPaginatedQuery";

export const useFetchPatients = (filters?: FetchPatientsFilters) => {
    const url = useMemo(
        () => `${API_BASE}/patients${buildPatientQueryString(filters)}`,
        [ filters ]
    );
    const { items: patients, loading, error, refetch: fetchPatients, total, totalPages } =
        useApiPaginatedQuery<Patient>(url,"Failed to load patients");

    return { patients, loading, error, fetchPatients, total, totalPages };
}