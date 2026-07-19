"use client";

import { useEffect, useRef, useCallback } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps focus within a container and restores focus on unmount.
 * Attach the returned ref to the modal/drawer panel element.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  onEscape?: () => void,
) {
  const ref = useRef<T>(null);
  const previousFocus = useRef<Element | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement;

    const el = ref.current;
    if (!el) return;

    const first = el.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    return () => {
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus();
      }
    };
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape" && onEscape) {
      e.stopPropagation();
      onEscape();
      return;
    }

    if (e.key !== "Tab" || !ref.current) return;

    const focusable = Array.from(
      ref.current.querySelectorAll<HTMLElement>(FOCUSABLE),
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, [onEscape]);

  return { ref, handleKeyDown };
}
