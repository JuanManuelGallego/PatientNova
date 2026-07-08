import { useCallback } from "react";
import { API_BASE } from "../types/API";
import { Appointment } from "../types/Appointment";
import { ReminderInlineData } from "../types/Reminder";
import { useApiMutation } from "./useApiMutation";

type UpdateAppointmentData = Omit<Partial<Appointment>, 'reminder'> & {
  reminder?: ReminderInlineData | null;
};

export const useUpdateAppointment = () => {
    const { mutate, loading, error } = useApiMutation<Appointment>("PATCH", "Failed to update appointment");
    const updateAppointment = useCallback(
        (id: string, data: UpdateAppointmentData) => mutate(`${API_BASE}/appointments/${id}`, data),
        [ mutate ]
    );
    return { updateAppointment, loading, error };
};