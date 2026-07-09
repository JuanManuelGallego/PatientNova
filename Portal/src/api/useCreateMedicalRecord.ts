import { MedicalRecord } from "../types/MedicalRecord";
import { createEntityCreate } from "./useEntityMutation";

export const useCreateMedicalRecord = createEntityCreate<MedicalRecord>({
    resource: "medical-records",
    name: "MedicalRecord",
    errorMessage: "Failed to create medical record",
});
