import { useApiMutation } from "@/src/api/base/useApiMutation";
import { API_BASE } from "@/src/config/api";
import { GoogleDisconnectResponse } from "@/src/types/Google";

export const useDisconnectGoogle = () => {
  const { mutate, loading, error } = useApiMutation<GoogleDisconnectResponse>(
    "DELETE",
    "Failed to disconnect Google account"
  );

  const disconnect = () => mutate(`${API_BASE}/google/connection`);

  return { disconnect, loading, error };
};