"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface FocusTrapContextValue {
  register: () => number;
  unregister: (id: number) => void;
}

const FocusTrapContext = createContext<FocusTrapContextValue | null>(null);

export function FocusTrapProvider({ children }: { children: ReactNode }) {
  const [openCount, setOpenCount] = useState(0);
  const savedScrollYRef = useRef(0);
  const idCounter = useRef(0);

  const register = useCallback(() => {
    const id = idCounter.current++;
    setOpenCount((c) => {
      if (c === 0) {
        savedScrollYRef.current = window.scrollY;
        document.body.style.position = "fixed";
        document.body.style.top = `-${savedScrollYRef.current}px`;
        document.body.style.left = "0";
        document.body.style.right = "0";
        document.body.style.overflow = "hidden";
      }
      return c + 1;
    });
    return id;
  }, []);

  const unregister = useCallback((id: number) => {
    setOpenCount((c) => {
      const next = c - 1;
      if (next === 0) {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.overflow = "";
        window.scrollTo(0, savedScrollYRef.current);
      }
      return next;
    });
  }, []);

  return (
    <FocusTrapContext.Provider value={{ register, unregister }}>
      {children}
    </FocusTrapContext.Provider>
  );
}

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  onEscape?: () => void,
) {
  const ref = useRef<T>(null);
  const previousFocus = useRef<Element | null>(null);
  const registrationId = useRef<number | null>(null);
  const ctx = useContext(FocusTrapContext);

  if (!ctx) {
    throw new Error("useFocusTrap must be used within a FocusTrapProvider");
  }
  const { register, unregister } = ctx;

  useEffect(() => {
    previousFocus.current = document.activeElement;

    const el = ref.current;
    if (!el) return;

    const first = el.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    registrationId.current = register();

    return () => {
      if (registrationId.current !== null) {
        unregister(registrationId.current);
      }

      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus();
      }
    };
  }, [register, unregister]);

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