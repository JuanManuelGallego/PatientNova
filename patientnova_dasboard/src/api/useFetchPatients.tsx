import { useState, useEffect, useCallback } from "react";
import { API_BASE, ApiPaginatedResponse } from "../types/API";
import { FetchPatientsFilters, Patient } from "../types/Patient";
import { buildPatientQueryString } from "../utils/ApiUtils";

export const useFetchPatients = (filters?: FetchPatientsFilters) => {
    const [ patients, setPatients ] = useState<Patient[]>([]);
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const [ total, setTotal ] = useState(0);
    const [ totalPages, setTotalPages ] = useState(0);

    const fetchPatients = useCallback(
        async (overrideFilters?: FetchPatientsFilters) => {
            setLoading(true); setError(null);

            try {
                const queryString = buildPatientQueryString(overrideFilters ?? filters);
                const res = await fetch(`${API_BASE}/patients${queryString}`, {
                    credentials: 'include', 
                });

                if (!res.ok) {
                    throw new Error(`Server error: ${res.status}`);
                }

                const json: ApiPaginatedResponse = await res.json();

                if (!json.success) {
                    throw new Error("API returned an error");
                }

                setPatients(json.data.data as Patient[]);
                setTotal(json.data.total);
                setTotalPages(json.data.totalPages);
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : "Failed to load patients"
                );
            } finally {
                setLoading(false);
            }
        },
        [ filters ]
    );

    useEffect(() => {
        fetchPatients();
    }, [ fetchPatients ]);

    return { patients, loading, error, fetchPatients, total, totalPages };
};