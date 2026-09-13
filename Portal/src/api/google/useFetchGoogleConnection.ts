import { useApiQuery } from "@/src/api/base/useApiQuery";
import { API_BASE } from "@/src/config/api";
import { GoogleConnectionStatus } from "@/src/types/Google";

export const useFetchGoogleConnection = (enabled = true) => {
  const { data, loading, error, refetch: fetchConnection } = useApiQuery<GoogleConnectionStatus>(
    enabled ? `${API_BASE}/google/connection` : null,
    "Failed to fetch Google connection status"
  );

  return { fetchConnection, loading, error, data };
};
