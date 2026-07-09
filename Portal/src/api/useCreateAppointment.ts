import { Appointment } from "../types/Appointment";
import { ReminderInlineData } from "../types/Reminder";
import { createEntityCreate } from "./useEntityMutation";

type CreateAppointmentData = Omit<Partial<Appointment>, 'reminder'> & {
    reminder?: ReminderInlineData | null;
};

export const useCreateAppointment = createEntityCreate<CreateAppointmentData>({
    resource: "appointments",
    name: "Appointment",
    errorMessage: "Failed to create appointment",
});
