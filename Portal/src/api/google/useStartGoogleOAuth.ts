import { useApiMutation } from "@/src/api/base/useApiMutation";
import { API_BASE } from "@/src/config/api";
import { GoogleOAuthStartResponse } from "@/src/types/Google";

export const useStartGoogleOAuth = () => {
  const { mutate, loading, error } = useApiMutation<GoogleOAuthStartResponse>(
    "POST",
    "Failed to start Google OAuth"
  );

  const startOAuth = (returnPath?: string, isReconnect?: boolean) =>
    mutate(`${API_BASE}/google/oauth/start`, { returnPath, isReconnect });

  return { startOAuth, loading, error };
};