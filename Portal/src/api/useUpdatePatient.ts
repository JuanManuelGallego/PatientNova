import { Patient } from "../types/Patient";
import { createEntityUpdate } from "./useEntityMutation";

export const useUpdatePatient = createEntityUpdate<Patient>({
    resource: "patients",
    name: "Patient",
    errorMessage: "Failed to update patient",
});
