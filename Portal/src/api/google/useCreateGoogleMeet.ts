import { useApiMutation } from "@/src/api/base/useApiMutation";
import { API_BASE } from "@/src/config/api";
import { GoogleMeetCreateResponse } from "@/src/types/Google";

export const useCreateGoogleMeet = () => {
  const { mutate, loading, error } = useApiMutation<GoogleMeetCreateResponse>(
    "POST",
    "Failed to create Google Meet link"
  );

  const createMeet = () => mutate(`${API_BASE}/google/meet`);

  return { createMeet, loading, error };
};