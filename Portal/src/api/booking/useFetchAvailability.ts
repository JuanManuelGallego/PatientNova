import { API_BASE } from "@/src/config/api";
import { useApiQuery } from "@/src/api/base/useApiQuery";
import { Availability } from "@/src/types/Booking";

export const useFetchAvailability = () => {
    const { data, loading, error, refetch } =
        useApiQuery<Availability>(`${API_BASE}/booking/availability`, "Failed to load availability");
    return { availability: data, loading, error, fetchAvailability: refetch };
};
