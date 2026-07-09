import { AppointmentLocation } from "../types/Appointment";
import { createEntityUpdate } from "./useEntityMutation";

export const useUpdateLocation = createEntityUpdate<AppointmentLocation>({
    resource: "locations",
    name: "Location",
    errorMessage: "Failed to update location",
});
