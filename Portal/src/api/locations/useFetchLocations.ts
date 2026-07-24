import { useMemo } from "react";
import { API_BASE } from "@/src/config/api";
import { AppointmentLocation } from "@/src/types/Appointment";
import { useApiQuery } from "@/src/api/base/useApiQuery";

export const useFetchLocations = (includeInactive = false) => {
    const { data, loading, error, refetch: fetchLocations } =
        useApiQuery<AppointmentLocation[]>(`${API_BASE}/locations`, "Failed to load locations");
    const locations = useMemo(
        () => (data ?? []).filter(l => includeInactive || l.isActive),
        [ data, includeInactive ]
    );
    return { data, locations, loading, error, fetchLocations };
};