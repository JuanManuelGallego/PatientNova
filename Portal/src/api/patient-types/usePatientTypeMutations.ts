import { useCallback } from "react";
import { API_BASE } from "@/src/config/api";
import { useApiMutation } from "@/src/api/base/useApiMutation";
import { fetchWithAuth } from "@/src/api/base/fetchWithAuth";
import { ApiClientError } from "@/src/api/base/apiClients";
import { toSpanishMessage } from "@/src/api/base/errorMessages";
import { ConsentVersion, PatientType } from "@/src/types/PatientType";

const BASE = `${API_BASE}/patient-types`;

export const CONSENT_PDF_MAX_BYTES = 10 * 1024 * 1024;

export function useCreatePatientType() {
    const { mutate, loading, error } = useApiMutation<PatientType>("POST", "No pudimos crear el tipo de paciente.");
    const createPatientType = useCallback((name: string) => mutate(BASE, { name }), [ mutate ]);
    return { createPatientType, loading, error };
}

export function useRenamePatientType() {
    const { mutate, loading, error } = useApiMutation<PatientType>("PATCH", "No pudimos renombrar el tipo de paciente.");
    const renamePatientType = useCallback((id: string, name: string) => mutate(`${BASE}/${id}`, { name }), [ mutate ]);
    return { renamePatientType, loading, error };
}

export function useSetDefaultPatientType() {
    const { mutate, loading, error } = useApiMutation<PatientType>("POST", "No pudimos cambiar el tipo predeterminado.");
    const setDefaultPatientType = useCallback((id: string) => mutate(`${BASE}/${id}/default`), [ mutate ]);
    return { setDefaultPatientType, loading, error };
}

export function useDeletePatientType() {
    const { mutate, loading, error } = useApiMutation("DELETE", "No pudimos eliminar el tipo de paciente.");
    const deletePatientType = useCallback((id: string) => mutate(`${BASE}/${id}`), [ mutate ]);
    return { deletePatientType, loading, error };
}

function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error ?? new Error("read failed"));
        reader.readAsDataURL(file);
    });
}

export function consentFileProblem(file: File): string | null {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return "Selecciona un archivo PDF.";
    if (file.size > CONSENT_PDF_MAX_BYTES) return "El archivo debe pesar menos de 10 MB.";
    return null;
}

export function useUploadConsentVersion() {
    const { mutate, loading, error } = useApiMutation<ConsentVersion>("POST", "No pudimos subir el formulario de consentimiento.");
    const uploadConsentVersion = useCallback(async (patientTypeId: string, file: File) => {
        const content = await readAsDataUrl(file);
        return mutate(`${BASE}/${patientTypeId}/consent-versions`, { name: file.name, content });
    }, [ mutate ]);
    return { uploadConsentVersion, loading, error };
}

export async function downloadConsentVersion(patientTypeId: string, versionId: string): Promise<Blob> {
    const res = await fetchWithAuth(`${BASE}/${patientTypeId}/consent-versions/${versionId}/download`);
    if (!res.ok) throw new ApiClientError(toSpanishMessage(res.status), res.status);
    return res.blob();
}
