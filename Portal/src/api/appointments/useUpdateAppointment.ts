import { Appointment } from "@/src/types/Appointment";
import { ReminderInlineData } from "@/src/types/Reminder";
import { createEntityUpdate } from "@/src/api/base/useEntityMutation";

type UpdateAppointmentData = Omit<Partial<Appointment>, 'reminder'> & {
    reminder?: ReminderInlineData | null;
};

export const useUpdateAppointment = createEntityUpdate<UpdateAppointmentData>({
    resource: "appointments",
    name: "Appointment",
    errorMessage: "Failed to update appointment",
});
