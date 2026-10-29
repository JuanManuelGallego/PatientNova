import { API_BASE } from "@/src/config/api";
import { useApiQuery } from "@/src/api/base/useApiQuery";
import { BookingSettings } from "@/src/types/Booking";

export const useFetchBookingSettings = () => {
    const { data, loading, error, refetch } =
        useApiQuery<BookingSettings>(`${API_BASE}/booking/settings`, "Failed to load booking settings");
    return { settings: data, loading, error, fetchSettings: refetch };
};
