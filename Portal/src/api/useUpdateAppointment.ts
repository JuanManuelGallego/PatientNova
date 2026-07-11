import { Appointment } from "../types/Appointment";
import { ReminderInlineData } from "../types/Reminder";
import { createEntityUpdate } from "./useEntityMutation";

type UpdateAppointmentData = Omit<Partial<Appointment>, 'reminder'> & {
    reminder?: ReminderInlineData | null;
};

export const useUpdateAppointment = createEntityUpdate<UpdateAppointmentData>({
    resource: "appointments",
    name: "Appointment",
    errorMessage: "Failed to update appointment",
});
