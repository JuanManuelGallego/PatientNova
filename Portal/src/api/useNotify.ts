import { useCallback } from "react";
import { API_BASE } from "../types/API";
import { Channel, Reminder } from "../types/Reminder";
import { useApiMutation } from "./useApiMutation";

export const useNotify = () => {
    const { mutate, loading, error } = useApiMutation<Reminder>("POST", "Failed to send notification");
    const notify = useCallback(
        (channel: Channel, payload: Partial<Reminder>) =>
            mutate(`${API_BASE}/notify/${channel.toLowerCase()}`, payload),
        [ mutate ]
    );
    return { notify, loading, error };
};