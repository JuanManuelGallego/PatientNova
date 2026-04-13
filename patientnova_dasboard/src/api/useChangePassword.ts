import { useState, useCallback } from "react";
import { API_BASE, ApiResponse } from "../types/API";
import { fetchWithAuth } from "./fetchWithAuth";

export const useChangePassword = () => {
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetchWithAuth(`${API_BASE}/user/me/change-password`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }

            const json: ApiResponse = await res.json();

            if (!json.success) {
                throw new Error("API returned an error");
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error al cambiar contraseña";
            setError(msg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { changePassword, loading, error };
};
