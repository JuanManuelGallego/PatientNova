import { useMemo } from "react";
import { API_BASE } from "../types/API";
import { Appointment, FetchAppointmentsFilters } from "../types/Appointment";
import { buildAppointmentQueryString } from "../utils/ApiUtils";
import { useApiPaginatedQuery } from "./useApiPaginatedQuery";

export const useFetchAppointments = (filters?: FetchAppointmentsFilters) => {
    const url = useMemo(
        () => `${API_BASE}/appointments${buildAppointmentQueryString(filters)}`,
        [ filters ]
    );
    const { items: appointments, loading, error, refetch: fetchAppointments, total, totalPages } =
        useApiPaginatedQuery<Appointment>(url, "Failed to load appointments");
    return { appointments, loading, error, fetchAppointments, total, totalPages };
};