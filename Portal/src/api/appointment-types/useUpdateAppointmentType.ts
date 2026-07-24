import { AppointmentType } from "@/src/types/Appointment";
import { createEntityUpdate } from "@/src/api/base/useEntityMutation";

export const useUpdateAppointmentType = createEntityUpdate<AppointmentType>({
    resource: "appointment-types",
    name: "AppointmentType",
    errorMessage: "Failed to update appointment type",
});
