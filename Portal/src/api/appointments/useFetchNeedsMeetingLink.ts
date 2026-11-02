import { useApiQuery } from "@/src/api/base/useApiQuery";
import { API_BASE } from "@/src/config/api";

export interface NeedsMeetingLink {
    count: number;
    appointments: { id: string; startAt: string }[];
}

/** Upcoming online bookings at a virtual location whose video-call link the provider still has to add (admins only). */
export const useFetchNeedsMeetingLink = (enabled = true) => {
    const { data, loading, error, refetch } = useApiQuery<NeedsMeetingLink>(
        enabled ? `${API_BASE}/appointments/needs-meeting-link` : null,
        "Failed to fetch appointments that need a meeting link",
    );
    return { data, loading, error, refetch };
};
