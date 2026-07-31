import { useMemo } from "react";
import { API_BASE } from "@/src/config/api";
import { useApiPaginatedQuery } from "@/src/api/base/useApiPaginatedQuery";
import { AuditLog, FetchAuditLogsFilters } from "@/src/types/AuditLog";
import { buildAuditLogQueryString } from "@/src/utils/ApiUtils";

export const useFetchAuditLogs = (filters?: FetchAuditLogsFilters) => {
    const url = useMemo(
        () => `${API_BASE}/audit-logs${buildAuditLogQueryString(filters)}`,
        [ filters ]
    );
    const { items: auditLogs, loading, error, refetch: fetchAuditLogs, total, totalPages } =
        useApiPaginatedQuery<AuditLog>(url, "Failed to load audit logs");
    return { auditLogs, loading, error, fetchAuditLogs, total, totalPages };
};
