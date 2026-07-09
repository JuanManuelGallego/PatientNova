import { AppointmentType } from "../types/Appointment";
import { createEntityUpdate } from "./useEntityMutation";

export const useUpdateAppointmentType = createEntityUpdate<AppointmentType>({
    resource: "appointment-types",
    name: "AppointmentType",
    errorMessage: "Failed to update appointment type",
});
