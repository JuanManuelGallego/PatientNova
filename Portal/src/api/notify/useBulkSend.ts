import { useCallback } from "react";
import { API_BASE } from "@/src/config/api";
import { Channel, ReminderMode } from "@/src/types/Reminder";
import { useApiMutation } from "@/src/api/base/useApiMutation";

export interface BulkSendResult {
  totalCount: number;
  queuedCount: number;
  skippedCount: number;
  channel: Channel;
  templateKey: string;
}

export interface BulkSendPayload {
  channel: Channel;
  templateKey: string;
  patientIds: string[];
  sendMode: ReminderMode;
  sendAt?: string;
  sharedVariables?: Record<string, string>;
  /** Raw message text with {{N}} placeholders — required when channel is SMS. */
  body?: string;
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
