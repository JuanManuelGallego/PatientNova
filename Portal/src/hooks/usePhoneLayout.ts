"use client";

import { useMediaQuery } from "@/src/hooks/useMediaQuery";

export const PHONE_MEDIA_QUERY = "(max-width: 639.98px)";

export function usePhoneLayout(): boolean {
  return useMediaQuery(PHONE_MEDIA_QUERY);
}
