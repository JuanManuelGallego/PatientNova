import { API_BASE } from "@/src/config/api";
import { Reminder } from "@/src/types/Reminder";
import { useApiQuery } from "@/src/api/base/useApiQuery";

export const useFetchReminder = (reminderId: string | undefined | null) => {
  const url = reminderId ? `${API_BASE}/reminders/${reminderId}` : null;
  const { data: reminder, loading, error, refetch: fetchReminder } =
    useApiQuery<Reminder>(url, "Failed to load reminder");

  return { reminder, loading, error, fetchReminder };
};
