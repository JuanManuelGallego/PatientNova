import { MedicalRecord } from "@/src/types/MedicalRecord";
import { createEntityUpdate } from "@/src/api/base/useEntityMutation";

export const useUpdateMedicalRecord = createEntityUpdate<MedicalRecord>({
    resource: "medical-records",
    name: "MedicalRecord",
    errorMessage: "Failed to update medical record",
});
