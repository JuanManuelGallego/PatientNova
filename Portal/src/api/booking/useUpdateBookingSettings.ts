import { useCallback } from "react";
import { API_BASE } from "@/src/config/api";
import { useApiMutation } from "@/src/api/base/useApiMutation";
import { BookingSettings, BookingSettingsUpdate } from "@/src/types/Booking";

export const useUpdateBookingSettings = () => {
    const { mutate, loading, error } = useApiMutation<BookingSettings>("PATCH", "Failed to update booking settings");
    const updateSettings = useCallback(
        (body: BookingSettingsUpdate) => mutate(`${API_BASE}/booking/settings`, body),
        [ mutate ],
    );
    return { updateSettings, loading, error };
};
