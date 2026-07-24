import { AppointmentLocation } from "@/src/types/Appointment";
import { createEntityUpdate } from "@/src/api/base/useEntityMutation";

export const useUpdateLocation = createEntityUpdate<AppointmentLocation>({
    resource: "locations",
    name: "Location",
    errorMessage: "Failed to update location",
});
