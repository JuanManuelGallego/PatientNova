import { createEntityDelete } from "@/src/api/base/useEntityMutation";

export const useDeleteMedicalRecord = createEntityDelete({
    resource: "medical-records",
    name: "MedicalRecord",
    errorMessage: "Failed to delete medical record",
});
