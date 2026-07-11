import { useMemo } from "react";
import { API_BASE } from "../types/API";
import { AppointmentLocation } from "../types/Appointment";
import { useApiQuery } from "./useApiQuery";

export const useFetchLocations = (includeInactive = false) => {
    const { data, loading, error, refetch: fetchLocations } =
        useApiQuery<AppointmentLocation[]>(`${API_BASE}/locations`, "Failed to load locations");
    const locations = useMemo(
        () => (data ?? []).filter(l => includeInactive || l.isActive),
        [ data, includeInactive ]
    );
    return { locations, loading, error, fetchLocations };
};