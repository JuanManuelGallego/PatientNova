import { MedicalRecord } from "@/src/types/MedicalRecord";
import { createEntityCreate } from "@/src/api/base/useEntityMutation";

export const useCreateMedicalRecord = createEntityCreate<MedicalRecord>({
    resource: "medical-records",
    name: "MedicalRecord",
    errorMessage: "Failed to create medical record",
});
