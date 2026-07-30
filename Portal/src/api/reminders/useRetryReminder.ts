import { useCallback } from "react";
import { API_BASE } from "@/src/config/api";
import { useApiMutation } from "@/src/api/base/useApiMutation";
import { Reminder } from "@/src/types/Reminder";

export function useRetryReminder() {
    const { mutate, loading, error } = useApiMutation<Reminder>(
        "POST",
        "Error al reintentar"
    );

    const retryReminder = useCallback(
        (id: string) => mutate(`${API_BASE}/reminders/${id}/retry`),
        [mutate]
    );

    return { retryReminder, loading, error };
}
