import { Patient } from "../types/Patient";
import { createEntityCreate } from "./useEntityMutation";

export const useCreatePatient = createEntityCreate<Patient>({
    resource: "patients",
    name: "Patient",
    errorMessage: "Failed to create patient",
});
