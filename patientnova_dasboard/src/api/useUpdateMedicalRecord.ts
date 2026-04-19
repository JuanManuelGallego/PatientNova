import { useState, useCallback } from "react";
import { API_BASE, ApiResponse } from "../types/API";
import { fetchWithAuth } from "./fetchWithAuth";
import { MedicalRecord } from "../types/MedicalRecord";

export const useUpdateMedicalRecord = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const updateMedicalRecord = useCallback(async (id: string, data: Partial<MedicalRecord>) => {
        setLoading(true); setError(null);
        try {
            const res = await fetchWithAuth(`${API_BASE}/medical-records/${id}`, {
                method: "PATCH", credentials: 'include',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            const json: ApiResponse = await res.json();
            if (!json.success) throw new Error("API returned an error");
            return json.data as MedicalRecord;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to update medical record";
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { updateMedicalRecord, loading, error };
};
