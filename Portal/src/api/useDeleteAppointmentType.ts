import { createEntityDelete } from "./useEntityMutation";

export const useDeleteAppointmentType = createEntityDelete({
    resource: "appointment-types",
    name: "AppointmentType",
    errorMessage: "Failed to delete appointment type",
});
