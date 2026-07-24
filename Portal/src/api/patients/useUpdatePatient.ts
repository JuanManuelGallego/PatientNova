import { Patient } from "@/src/types/Patient";
import { createEntityUpdate } from "@/src/api/base/useEntityMutation";

export const useUpdatePatient = createEntityUpdate<Patient>({
    resource: "patients",
    name: "Patient",
    errorMessage: "Failed to update patient",
});
