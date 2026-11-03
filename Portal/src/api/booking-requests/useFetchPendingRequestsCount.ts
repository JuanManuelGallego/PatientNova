import { useApiQuery } from "@/src/api/base/useApiQuery";
import { API_BASE } from "@/src/config/api";

/** Live pending requests. Admin-only endpoint: pass `enabled = false` for VIEWER or with the portal off. */
export const useFetchPendingRequestsCount = (enabled: boolean) => {
    const { data, loading, error, refetch } = useApiQuery<{ pending: number }>(
        enabled ? `${API_BASE}/booking-requests/count` : null,
        "No pudimos cargar las solicitudes pendientes",
    );
    return { pending: data?.pending ?? 0, loading, error, refetch };
};
