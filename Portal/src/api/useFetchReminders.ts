import { useMemo } from "react";
import { API_BASE } from "../types/API";
import { FetchRemindersFilters, Reminder } from "../types/Reminder";
import { buildReminderQueryString } from "../utils/ApiUtils";
import { useApiPaginatedQuery } from "./useApiPaginatedQuery";

export const useFetchReminders = (filters?: FetchRemindersFilters) => {
    const url = useMemo(
        () => `${API_BASE}/reminders${buildReminderQueryString(filters)}`,
        [ filters ]
    );
    const { items: reminders, loading, error, refetch: fetchReminders, total, totalPages } =
        useApiPaginatedQuery<Reminder>(url, "Failed to load reminders");
    return { reminders, loading, error, fetchReminders, total, totalPages };
};