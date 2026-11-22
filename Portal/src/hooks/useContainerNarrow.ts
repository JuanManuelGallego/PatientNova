"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

export function useContainerNarrow(
  ref: RefObject<HTMLElement | null>,
  maxWidth: number,
  enabled = true,
): boolean {
  const [ narrow, setNarrow ] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof ResizeObserver === "undefined") return;
    const apply = (width: number) => {
      if (width > 0) setNarrow(width < maxWidth);
    };
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
