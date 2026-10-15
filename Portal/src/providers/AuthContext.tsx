"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { API_BASE } from "@/src/config/api";
import { ApiResponse } from "@/src/types/API";
import { User } from '@/src/types/User';
import { clearCsrfToken, fetchWithAuth } from "@/src/api/base/fetchWithAuth";
import { toSpanishMessage } from "@/src/api/base/errorMessages";
import { ApiClientError, parseEnvelope } from "@/src/api/base/apiClients";

interface AuthContextValue {
    user: User | null;
    isAuthenticated: boolean;
    initializing: boolean;
    loading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    updateUser: (user: User) => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [ user, setUser ] = useState<User | null>(null);
    const [ initializing, setInitializing ] = useState(true);
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);

    useEffect(() => {
        async function checkSession() {
            try {
                const res = await fetchWithAuth(
                    `${API_BASE}/users/me`,
                    { credentials: "include" },
                    { redirectOnUnauthorized: false },
                );
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

            // On the login form a bare 401 means bad credentials, not an expired session.
            const loggedIn = await parseEnvelope<User>(res, { 401: "Correo o contraseña incorrectos." });

            clearCsrfToken();
            setUser(loggedIn);
        } catch (err) {
            // Only ApiClientError carries a curated Spanish message; anything else (fetch TypeError) is a connection failure.
            const msg = err instanceof ApiClientError ? err.message : toSpanishMessage(0);
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
            clearCsrfToken();
            setUser(null);
            setLoading(false);
        }
    }, []);

    const updateUser = useCallback((updated: User) => {
        setUser(updated);
    }, []);

    const refreshUser = useCallback(async () => {
        try {
            const res = await fetchWithAuth(`${API_BASE}/users/me`, { credentials: "include" });
            if (res.ok) {
                const json: ApiResponse = await res.json();
                if (json.success) setUser(json.data as User);
            }
        } catch {
            // Silently ignore — user data stays as-is
        }
    }, []);

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: user !== null, initializing, loading, error, login, logout, updateUser, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuthContext() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuthContext must be used inside <AuthProvider>");
    return ctx;
}
