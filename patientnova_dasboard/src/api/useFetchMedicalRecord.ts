import { useState, useCallback } from "react";
import { API_BASE, ApiResponse } from "../types/API";
import { fetchWithAuth } from "./fetchWithAuth";
import { MedicalRecord } from "../types/MedicalRecord";

export const useFetchMedicalRecord = (medicalRecordId: string | undefined) => {
    const [ medicalRecord, setMedicalRecord ] = useState<MedicalRecord>();
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    const fetchMedicalRecord = useCallback(async () => {
        if (!medicalRecordId) {
            setMedicalRecord(undefined);
            return;
        }
        setLoading(true); setError(null);

        try {
            const res = await fetchWithAuth(`${API_BASE}/medical-records/${medicalRecordId}`);

            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }

            const json: ApiResponse = await res.json();

            if (!json.success) {
                throw new Error("API returned an error");
            }

            setMedicalRecord(json.data as MedicalRecord);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load medical record");
        } finally {
            setLoading(false);
        }
    }, [ medicalRecordId ]);

    return { medicalRecord, loading, error, fetchMedicalRecord };
};
