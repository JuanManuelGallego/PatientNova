import { useState, useRef, useEffect, useCallback } from "react";
import { API_BASE } from "../types/API";
import { User } from "../types/User";
import { useApiMutation } from "./useApiMutation";
import { useAuthContext } from "../app/AuthContext";

const AUTO_SAVE_DEBOUNCE_MS = 1000;
const SAVE_STATUS_CLEAR_MS = 3000;

type SaveStatus = "idle" | "saved" | "error";

export const useUpdateProfileWithDebounce = (userData: Partial<User> | null): SaveStatus => {
    const [ saveStatus, setSaveStatus ] = useState<SaveStatus>("idle");
    const isPopulated = useRef(false);
    const { mutate } = useApiMutation<User>("PATCH", "Error al guardar");
    const { user, updateUser } = useAuthContext();

    useEffect(() => {
        if (!userData) return;

        if (!isPopulated.current) {
            isPopulated.current = true;
            return;
        }

        // Optimistic update fires immediately, before the debounce
        updateUser({ ...user, ...userData } as User);

        const timeout = setTimeout(async () => {
            try {
                await mutate(`${API_BASE}/users/me`, userData);
                setSaveStatus("saved");
            } catch (err) {
                console.error("Error auto-saving profile:", err);
                setSaveStatus("error");
            } finally {
                setTimeout(() => setSaveStatus("idle"), SAVE_STATUS_CLEAR_MS);
            }
        }, AUTO_SAVE_DEBOUNCE_MS);

        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ userData, updateUser, mutate ]);

    return saveStatus;
};


export const useUpdateProfile = () => {
    const { mutate, loading, error } = useApiMutation<User>("PATCH", "Error al guardar");
    const { user, updateUser } = useAuthContext();

    const updateProfile = useCallback((userData: Partial<User>) => {
        updateUser({ ...user, ...userData } as User); // Optimistic update
        mutate(`${API_BASE}/users/me`, userData)
    },
        [ mutate, updateUser, user ]
    );
    return { updateProfile, loading, error };

};