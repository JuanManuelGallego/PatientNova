import { createEntityDelete } from "@/src/api/base/useEntityMutation";

export const useDeleteAppointment = createEntityDelete({
    resource: "appointments",
    name: "Appointment",
    errorMessage: "Failed to delete appointment",
});
