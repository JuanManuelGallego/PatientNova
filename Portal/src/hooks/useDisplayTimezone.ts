"use client";

import { useSyncExternalStore } from "react";
import { browserTimezone, getDisplayTimezone, subscribeDisplayTimezone } from "@/src/utils/TimeUtils";

/**
 * The provider's display timezone (`user.timezone`, browser zone until it is known). Components that render or
 * compute dates read it here and pass it to the TimeUtils helpers, so a timezone change in Settings re-renders
 * them in place instead of remounting the app.
 */
export function useDisplayTimezone(): string {
    return useSyncExternalStore(subscribeDisplayTimezone, getDisplayTimezone, browserTimezone);
}
