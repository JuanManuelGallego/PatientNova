import { useApiQuery } from "@/src/api/base/useApiQuery";
import { API_BASE } from "@/src/config/api";
import type { BookingRequestDetail } from "@/src/types/BookingRequest";

export const useFetchBookingRequest = (id: string | null) => {
    const { data, loading, error, refetch } = useApiQuery<BookingRequestDetail>(
        id ? `${API_BASE}/booking-requests/${id}` : null,
        "No pudimos cargar la solicitud",
    );
    return { request: data, loading, error, fetchRequest: refetch };
};
