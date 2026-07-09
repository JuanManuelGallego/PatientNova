import { AppointmentLocation } from "../types/Appointment";
import { createEntityCreate } from "./useEntityMutation";

export const useCreateLocation = createEntityCreate<AppointmentLocation>({
    resource: "locations",
    name: "Location",
    errorMessage: "Failed to create location",
});
