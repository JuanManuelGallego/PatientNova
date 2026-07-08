import { useCallback } from "react";
import { API_BASE } from "../types/API";
import { Appointment } from "../types/Appointment";
import { ReminderInlineData } from "../types/Reminder";
import { useApiMutation } from "./useApiMutation";

type CreateAppointmentData = Omit<Partial<Appointment>, 'reminder'> & {
  reminder?: ReminderInlineData | null;
};

export const useCreateAppointment = () => {
    const { mutate, loading, error } = useApiMutation<Appointment>("POST", "Failed to create appointment");
    const createAppointment = useCallback(
        (data: CreateAppointmentData) => mutate(`${API_BASE}/appointments`, data),
        [ mutate ]
    );
    return { createAppointment, loading, error };
};