import { Appointment } from "@/src/types/Appointment";
import { ReminderInlineData } from "@/src/types/Reminder";
import { createEntityCreate } from "@/src/api/base/useEntityMutation";

type CreateAppointmentData = Omit<Partial<Appointment>, 'reminder'> & {
    reminder?: ReminderInlineData | null;
};

export const useCreateAppointment = createEntityCreate<CreateAppointmentData>({
    resource: "appointments",
    name: "Appointment",
    errorMessage: "Failed to create appointment",
});
