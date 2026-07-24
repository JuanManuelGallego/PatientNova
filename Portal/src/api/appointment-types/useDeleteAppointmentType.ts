import { createEntityDelete } from "@/src/api/base/useEntityMutation";

export const useDeleteAppointmentType = createEntityDelete({
    resource: "appointment-types",
    name: "AppointmentType",
    errorMessage: "Failed to delete appointment type",
});
