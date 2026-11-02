import { useApiMutation } from "@/src/api/base/useApiMutation";
import { API_BASE } from "@/src/config/api";
import { GoogleConnectionStatus } from "@/src/types/Google";

export const useVerifyGoogleConnection = () => {
  const { mutate, loading, error } = useApiMutation<GoogleConnectionStatus>(
    "POST",
    "No se pudo verificar la conexión con Google."
  );

  const verifyConnection = () => mutate(`${API_BASE}/google/connection/verify`);

  return { verifyConnection, loading, error };
};
