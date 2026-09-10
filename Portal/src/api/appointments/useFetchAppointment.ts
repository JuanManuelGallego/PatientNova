import { API_BASE } from "@/src/config/api";
import { Appointment } from "@/src/types/Appointment";
import { useApiQuery } from "@/src/api/base/useApiQuery";

export const useFetchAppointment = (appointmentId: string | undefined | null) => {
  const url = appointmentId ? `${API_BASE}/appointments/${appointmentId}` : null;
  const { data: appointment, loading, error, refetch: fetchAppointment } =
    useApiQuery<Appointment>(url, "Failed to load appointment");

  return { appointment, loading, error, fetchAppointment };
};
