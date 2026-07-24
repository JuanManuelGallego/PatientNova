import { useMemo } from "react";
import { API_BASE } from "@/src/config/api";
import { Appointment, FetchAppointmentsFilters } from "@/src/types/Appointment";
import { buildAppointmentQueryString } from "@/src/utils/ApiUtils";
import { useApiPaginatedQuery } from "@/src/api/base/useApiPaginatedQuery";

export const useFetchAppointments = (filters?: FetchAppointmentsFilters) => {
    const url = useMemo(
        () =>
            `${API_BASE}/appointments${buildAppointmentQueryString({
                ...filters,
                pageSize: filters?.pageSize ?? 250,
            })}`,
        [ filters ],
    );
    const { items: appointments, loading, error, refetch: fetchAppointments, total, totalPages } =
        useApiPaginatedQuery<Appointment>(url, "Failed to load appointments");
    return { appointments, loading, error, fetchAppointments, total, totalPages };
};
