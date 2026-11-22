"use client";

import { useMediaQuery } from "@/src/hooks/useMediaQuery";

/** Screens narrower than 640px get the phone layout (agenda calendar, floating action button). */
export const PHONE_MEDIA_QUERY = "(max-width: 639.98px)";

/**
 * Whether the viewport is phone-sized. It is `false` where it can't be measured (server render, jsdom with no
 * matching query), so those keep the desktop layout.
 */
export function usePhoneLayout(): boolean {
  return useMediaQuery(PHONE_MEDIA_QUERY);
}
