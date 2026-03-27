import { useState, useCallback } from "react";
import { API_BASE, ApiResponse } from "../types/API";
import { User } from "../types/User";

export const useAuth = () => {
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    const login = useCallback(async (email: string, password: string) => {
        setLoading(true); setError(null);

        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
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
            const errorMessage = err instanceof Error ? err.message : "Failed to login";
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const logout = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await fetch(`${API_BASE}/auth/logout`, {
                method: "POST",
                credentials: "include",
            });

            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }

            const json: ApiResponse = await res.json();

            if (!json.success) {
                throw new Error("API returned an error");
            }

            return json.data;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to logout";
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { login, logout, loading, error };
};
