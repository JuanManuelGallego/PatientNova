import { AppointmentType } from "@/src/types/Appointment";
import { createEntityCreate } from "@/src/api/base/useEntityMutation";

export const useCreateAppointmentType = createEntityCreate<AppointmentType>({
    resource: "appointment-types",
    name: "AppointmentType",
    errorMessage: "Failed to create appointment type",
});
