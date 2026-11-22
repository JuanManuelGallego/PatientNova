"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Whether `ref`'s element is narrower than `maxWidth` px, tracked with a ResizeObserver.
 *
 * It measures in a layout effect, so the first paint already uses the narrow layout. It stays `false` while
 * `enabled` is off, before the element has a width, and where ResizeObserver is missing (jsdom), so callers
 * fall back to their wide layout.
 */
export function useContainerNarrow(
  ref: RefObject<HTMLElement | null>,
  maxWidth: number,
  enabled = true,
): boolean {
  const [ narrow, setNarrow ] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof ResizeObserver === "undefined") return;
    // A zero width means not laid out yet (or hidden): keep the current layout until a real width arrives.
    const apply = (width: number) => {
      if (width > 0) setNarrow(width < maxWidth);
    };
    // One box for both reads (the content box), so a width near the threshold can't flip after the first paint.
    apply(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) apply(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ ref, maxWidth, enabled ]);

  return enabled && narrow;
}
