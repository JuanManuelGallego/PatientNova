import { createEntityDelete } from "./useEntityMutation";

export const useDeletePatient = createEntityDelete({
    resource: "patients",
    name: "Patient",
    errorMessage: "Failed to delete patient",
});
