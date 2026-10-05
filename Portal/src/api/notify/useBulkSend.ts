import { useCallback } from "react";
import { API_BASE } from "@/src/config/api";
import { ReminderMode } from "@/src/types/Reminder";
import { useApiMutation } from "@/src/api/base/useApiMutation";

export interface BulkSendResult {
  totalCount: number;
  queuedCount: number;
  skippedCount: number;
  templateKey: string;
}

export interface BulkSendPayload {
  templateKey: string;
  patientIds: string[];
  sendMode: ReminderMode;
  sendAt?: string;
  sharedVariables?: Record<string, string>;
  /**
   * Raw message text with {{N}} placeholders. Each patient is messaged on their
   * own reminderChannel; SMS/EMAIL patients receive this body rendered per patient.
   */
  body: string;
}

export const useBulkSend = () => {
  const { mutate } = useApiMutation<BulkSendResult>(
    "POST",
    "Error al enviar mensajes masivos"
  );

  const bulkSend = useCallback(
    (payload: BulkSendPayload) =>
      mutate(`${API_BASE}/notify/bulk`, payload),
    [mutate]
  );

  return { bulkSend };
};
