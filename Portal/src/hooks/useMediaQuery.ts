"use client";

import { useSyncExternalStore, useCallback } from "react";

/**
 * Reactive media-query hook backed by useSyncExternalStore.
 * Returns `false` during SSR (mobile-first default).
 */
export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            const mql = window.matchMedia(query);
            mql.addEventListener("change", onStoreChange);
            return () => mql.removeEventListener("change", onStoreChange);
        },
        [query],
    );

    const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

    // SSR always returns false (mobile-first)
    const getServerSnapshot = useCallback(() => false, []);

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
