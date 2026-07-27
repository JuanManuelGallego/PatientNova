import { useMemo } from "react";
import { API_BASE } from "@/src/config/api";
import { BlockedTime, FetchBlockedTimeFilters } from "@/src/types/BlockedTime";
import { buildBlockedTimeQueryString } from "@/src/utils/ApiUtils";
import { useApiPaginatedQuery } from "@/src/api/base/useApiPaginatedQuery";

export const useFetchBlockedTimes = (filters?: FetchBlockedTimeFilters) => {
    const url = useMemo(
        () =>
            `${API_BASE}/blocked-time${buildBlockedTimeQueryString({
                ...filters,
                pageSize: filters?.pageSize ?? 250,
            })}`,
        [ filters ],
    );
    const { items: blockedTimes, loading, error, refetch: fetchBlockedTimes, total, totalPages } =
        useApiPaginatedQuery<BlockedTime>(url, "Failed to load blocked times");
    return { blockedTimes, loading, error, fetchBlockedTimes, total, totalPages };
};
