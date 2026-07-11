import { API_BASE } from "../types/API";
import { AppointmentType } from "../types/Appointment";
import { useApiQuery } from "./useApiQuery";

export const useFetchAppointmentTypes = () => {
    const { data, loading, error, refetch: fetchAppointmentTypes } =
        useApiQuery<AppointmentType[]>(`${API_BASE}/appointment-types`, "Failed to load appointment types");
    return { data, appointmentTypes: data ?? [], loading, error, fetchAppointmentTypes };
};