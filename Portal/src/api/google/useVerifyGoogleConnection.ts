import { useApiMutation } from "@/src/api/base/useApiMutation";
import { API_BASE } from "@/src/config/api";
import { GoogleConnectionStatus } from "@/src/types/Google";

/** Checks the stored Google token with Google now (limited server-side to 5 per minute). */
export const useVerifyGoogleConnection = () => {
  const { mutate, loading, error } = useApiMutation<GoogleConnectionStatus>(
    "GET",
    "No se pudo verificar la conexión con Google."
  );

  const verifyConnection = () => mutate(`${API_BASE}/google/connection?verify=true`);

  return { verifyConnection, loading, error };
};
