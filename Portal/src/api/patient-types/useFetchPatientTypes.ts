import { API_BASE } from "@/src/config/api";
import { useApiQuery } from "@/src/api/base/useApiQuery";
import { PatientType } from "@/src/types/PatientType";

export const useFetchPatientTypes = () => {
    const { data, loading, error, refetch } =
        useApiQuery<PatientType[]>(`${API_BASE}/patient-types`, "No pudimos cargar los tipos de paciente.");
    const patientTypes = data ?? [];
    return {
        data,
        patientTypes,
        defaultType: patientTypes.find((t) => t.isDefault) ?? null,
        loading,
        error,
        refetch,
    };
};
