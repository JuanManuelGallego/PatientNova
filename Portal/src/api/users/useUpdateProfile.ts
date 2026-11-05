import { useCallback } from "react";
import { API_BASE } from "@/src/config/api";
import { User } from "@/src/types/User";
import { useApiMutation } from "@/src/api/base/useApiMutation";
import { useAuthContext } from "@/src/providers/AuthContext";
import { useDebouncedSave } from "@/src/hooks/useDebouncedSave";

export const useAutoSaveProfile = () => {
    const { mutate } = useApiMutation<User>("PATCH", "Error al guardar");
    const { user, updateUser } = useAuthContext();
    const { schedule: scheduleSave, ...autosave } = useDebouncedSave<Partial<User>>(
        (userData) => mutate(`${API_BASE}/users/me`, userData),
    );

    const schedule = useCallback((userData: Partial<User>) => {
        updateUser({ ...user, ...userData } as User); // Optimistic update
        scheduleSave(userData);
    }, [ scheduleSave, updateUser, user ]);

    return { ...autosave, schedule };
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
