import { useCallback } from "react";
import { API_BASE } from "@/src/config/api";
import { useApiMutation } from "@/src/api/base/useApiMutation";

/** Sends the welcome message from the server, linking the current consent PDF of the patient's type. */
export function useSendWelcome() {
    const { mutate, loading, error } = useApiMutation<{ reminderId: string }>("POST", "No pudimos enviar el mensaje de bienvenida.");
    const sendWelcome = useCallback((patientId: string) => mutate(`${API_BASE}/patients/${patientId}/welcome`), [ mutate ]);
    return { sendWelcome, loading, error };
}
