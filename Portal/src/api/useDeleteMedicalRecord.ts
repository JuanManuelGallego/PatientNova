import { createEntityDelete } from "./useEntityMutation";

export const useDeleteMedicalRecord = createEntityDelete({
    resource: "medical-records",
    name: "MedicalRecord",
    errorMessage: "Failed to delete medical record",
});
