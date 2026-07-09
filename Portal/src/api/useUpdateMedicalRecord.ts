import { MedicalRecord } from "../types/MedicalRecord";
import { createEntityUpdate } from "./useEntityMutation";

export const useUpdateMedicalRecord = createEntityUpdate<MedicalRecord>({
    resource: "medical-records",
    name: "MedicalRecord",
    errorMessage: "Failed to update medical record",
});
