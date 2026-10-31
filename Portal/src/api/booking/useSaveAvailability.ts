import { useCallback } from "react";
import { API_BASE } from "@/src/config/api";
import { useApiMutation } from "@/src/api/base/useApiMutation";
import { Availability, AvailabilityRule } from "@/src/types/Booking";

export const useSaveAvailability = () => {
    const { mutate, loading, error } = useApiMutation<Availability>("PUT", "Failed to save availability");
    const saveAvailability = useCallback(
        (rules: AvailabilityRule[]) => mutate(`${API_BASE}/booking/availability`, { rules }),
        [ mutate ],
    );
    return { saveAvailability, loading, error };
};
