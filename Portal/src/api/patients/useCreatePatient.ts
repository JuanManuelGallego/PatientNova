import { Patient } from "@/src/types/Patient";
import { createEntityCreate } from "@/src/api/base/useEntityMutation";

export const useCreatePatient = createEntityCreate<Patient>({
    resource: "patients",
    name: "Patient",
    errorMessage: "Failed to create patient",
});
