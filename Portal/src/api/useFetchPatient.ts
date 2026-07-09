import { useMemo } from "react";
import { API_BASE } from "../types/API";
import { Patient } from "../types/Patient";
import { useApiQuery } from "./useApiQuery";

export const useFetchPatient = (patientId: string) => {
    const url = useMemo(
        () => `${API_BASE}/patients/${patientId}`,
        [ patientId ]
    );
    const { data: patient, loading, error, refetch: fetchPatient } =
        useApiQuery<Patient>(url, "Failed to load patient" );

    return { patient, loading, error, fetchPatient };
}