import { useApiPaginatedQuery } from "@/src/api/base/useApiPaginatedQuery";
import { API_BASE } from "@/src/config/api";
import { buildQueryString } from "@/src/utils/ApiUtils";
import type { BookingRequest, BookingRequestTab } from "@/src/types/BookingRequest";

export interface FetchBookingRequestsFilters {
    status: BookingRequestTab;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
}

export function bookingRequestsUrl(filters: FetchBookingRequestsFilters): string {
    return `${API_BASE}/booking-requests${buildQueryString({ ...filters })}`;
}

export const useFetchBookingRequests = (filters: FetchBookingRequestsFilters, enabled = true) => {
    const { items, total, totalPages, loading, error, refetch } = useApiPaginatedQuery<BookingRequest>(
        enabled ? bookingRequestsUrl(filters) : null,
        "No pudimos cargar las solicitudes",
    );
    return { requests: items, total, totalPages, loading, error, fetchRequests: refetch };
};
