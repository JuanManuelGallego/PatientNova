import { AppointmentType } from "../types/Appointment";
import { createEntityCreate } from "./useEntityMutation";

export const useCreateAppointmentType = createEntityCreate<AppointmentType>({
    resource: "appointment-types",
    name: "AppointmentType",
    errorMessage: "Failed to create appointment type",
});
