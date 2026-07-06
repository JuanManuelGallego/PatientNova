import { useCallback } from "react";
import { API_BASE } from "../types/API";
import { useApiMutation } from "./useApiMutation";

export const useChangePassword = () => {
    const { mutate, loading, error } = useApiMutation("PATCH", "Error al cambiar contraseña");
    const changePassword = useCallback(
        (currentPassword: string, newPassword: string) =>
            mutate(`${API_BASE}/auth/change-password`, { currentPassword, newPassword }),
        [ mutate ]
    );
    return { changePassword, loading, error };
};