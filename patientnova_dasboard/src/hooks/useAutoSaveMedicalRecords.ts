import { useState, useRef, useEffect } from "react";
import { FormValues } from "../types/MedicalRecord";
import { MedicalRecord } from '@/src/types/MedicalRecord';

const AUTO_SAVE_DEBOUNCE_MS = 1500;
const SAVE_STATUS_CLEAR_MS = 3000;

type SaveStatus = "idle" | "saved" | "error";

export function useAutoSaveMedicalRecords(
    form: FormValues,
    recordId: string | undefined,
    updateMedicalRecord: (id: string, form: FormValues) => Promise<MedicalRecord>,
): SaveStatus {
    const [ saveStatus, setSaveStatus ] = useState<SaveStatus>("idle");
    const isPopulated = useRef(false);

    useEffect(() => {
        isPopulated.current = false;
    }, [ recordId ]);

    useEffect(() => {
        if (!recordId) return;

        if (!isPopulated.current) {
            isPopulated.current = true;
            return;
        }

        const timeout = setTimeout(async () => {
            try {
                await updateMedicalRecord(recordId, form);
                setSaveStatus("saved");
            } catch (err) {
                console.error("Error auto-saving medical record:", err);
                setSaveStatus("error");
            } finally {
                setTimeout(() => setSaveStatus("idle"), SAVE_STATUS_CLEAR_MS);
            }
        }, AUTO_SAVE_DEBOUNCE_MS);

        return () => clearTimeout(timeout);
    }, [ form, recordId, updateMedicalRecord ]);

    return saveStatus;
}