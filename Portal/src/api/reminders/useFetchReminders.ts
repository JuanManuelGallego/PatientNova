import { useMemo } from "react";
import { API_BASE } from "@/src/config/api";
import { useApiPaginatedQuery } from "@/src/api/base/useApiPaginatedQuery";
import { FetchRemindersFilters, Reminder } from "@/src/types/Reminder";
import { buildReminderQueryString } from "@/src/utils/apiUtils";

export const useFetchReminders = (filters?: FetchRemindersFilters) => {
    const url = useMemo(
        () => `${API_BASE}/reminders${buildReminderQueryString(filters)}`,
        [ filters ]
    );
    const { items: reminders, loading, error, refetch: fetchReminders, total, totalPages } =
        useApiPaginatedQuery<Reminder>(url, "Failed to load reminders");
    return { reminders, loading, error, fetchReminders, total, totalPages };
};