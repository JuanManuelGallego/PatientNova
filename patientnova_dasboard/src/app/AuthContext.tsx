"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { API_BASE, ApiResponse } from "@/src/types/API";
import { User } from '../types/User';
import { fetchWithAuth } from "../api/fetchWithAuth";

interface AuthContextValue {
    user: User | null;
    isAuthenticated: boolean;
    initializing: boolean;
    loading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [ user, setUser ] = useState<User | null>(null);
    const [ initializing, setInitializing ] = useState(true);
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    // Check for an existing session on mount
    useEffect(() => {
        async function checkSession() {
            try {
                const res = await fetchWithAuth(`${API_BASE}/users/me`, { credentials: "include" });
                if (res.ok) {
                    const json: ApiResponse = await res.json();
                    if (json.success) setUser(json.data as User);
                }
            } catch {
                // No active session — leave user as null
            } finally {
                setInitializing(false);
            }
        }

        checkSession();
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        setLoading(true); setError(null);

        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            if (!res.ok) throw new Error(`Server error: ${res.status}`);

            const json: ApiResponse = await res.json();
            if (!json.success) throw new Error("Login failed");

            setUser(json.data as User);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to login";
            setError(msg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const logout = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            await fetchWithAuth(`${API_BASE}/auth/logout`, {
                method: "POST",
                credentials: "include",
            });
        } finally {
            setUser(null);
            setLoading(false);
        }
    }, []);

    const updateUser = useCallback((updated: User) => {
        setUser(updated);
    }, []);

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: user !== null, initializing, loading, error, login, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuthContext() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuthContext must be used inside <AuthProvider>");
    return ctx;
}
