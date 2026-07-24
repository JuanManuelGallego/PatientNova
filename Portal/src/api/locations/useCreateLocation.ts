import { AppointmentLocation } from "@/src/types/Appointment";
import { createEntityCreate } from "@/src/api/base/useEntityMutation";

export const useCreateLocation = createEntityCreate<AppointmentLocation>({
    resource: "locations",
    name: "Location",
    errorMessage: "Failed to create location",
});
