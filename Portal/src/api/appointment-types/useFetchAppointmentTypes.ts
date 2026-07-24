import { API_BASE } from "@/src/config/api";
import { AppointmentType } from "@/src/types/Appointment";
import { useApiQuery } from "@/src/api/base/useApiQuery";

export const useFetchAppointmentTypes = () => {
    const { data, loading, error, refetch: fetchAppointmentTypes } =
        useApiQuery<AppointmentType[]>(`${API_BASE}/appointment-types`, "Failed to load appointment types");
    return { data, appointmentTypes: data ?? [], loading, error, fetchAppointmentTypes };
};