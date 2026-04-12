import { useState, useCallback } from "react";
import { API_BASE, ApiResponse } from "../types/API";
import { User } from "../types/User";
import { fetchWithAuth } from "./fetchWithAuth";

export interface UpdateProfilePayload {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    jobTitle?: string;
    avatarUrl?: string | null;
    timezone?: string;
}

export const useUpdateProfile = () => {
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    const updateProfile = useCallback(async (payload: UpdateProfilePayload) => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetchWithAuth(`${API_BASE}/auth/me`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }

            const json: ApiResponse = await res.json();

            if (!json.success) {
                throw new Error("API returned an error");
            }

            return json.data as User;
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error al guardar";
            setError(msg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { updateProfile, loading, error };
};
