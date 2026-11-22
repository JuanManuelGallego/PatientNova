"use client";

import { createContext, useContext, useEffect, useRef, useCallback, useId, useMemo, ReactNode, RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Dismiss = RefObject<(() => void) | undefined>;

interface BackEntries {
  add: (key: string, dismiss: Dismiss) => void;
  remove: (key: string) => void;
  /** The overlay is closing because a navigation replaces its entry: drop it without going back. */
  release: (key: string) => void;
  /** Dismisses the top overlay if we stand on its entry; `viaNavigation` as for `release`. */
  closeTop: (viaNavigation: boolean) => boolean;
  enterScope: (key: string) => void;
  leaveScope: (key: string) => void;
  /** Runs `fn` once no overlay entry is closing and our own back() traversals have landed. */
  whenSettled: (fn: () => void) => void;
}

interface FocusTrapContextValue {
  register: () => number;
  unregister: () => void;
  /** Present only with `dismissOnBack`. */
  back: BackEntries | null;
}

const FocusTrapContext = createContext<FocusTrapContextValue | null>(null);

// Unique per document load, so an entry left by an earlier load never matches a live overlay.
let documentPrefix: string | null = null;
function entryValue(key: string) {
  documentPrefix ??= Math.random().toString(36).slice(2, 8);
  return `${documentPrefix}${key}`;
}

/**
 * Back-button support: each open overlay owns one history entry (`history.state.overlay`), so Back closes the
 * top overlay instead of leaving the page. `pushed` mirrors those entries, bottom to top.
 *
 * A programmatic back() makes the app router restore that entry, which discards any navigation in flight. So it
 * only goes back for an overlay the UI closed on a page that stays: never for one released to a navigation, nor
 * for one whose page (`useBackScope`) unmounted with it, as when logging out or leaving through a link.
 */
function useBackEntries(enabled: boolean): BackEntries | null {
  const open = useRef<{ key: string; dismiss: Dismiss }[]>([]);
  const pushed = useRef<string[]>([]);
  const closing = useRef(new Set<string>());
  const navigating = useRef(new Set<string>());
  const scopes = useRef<string[]>([]);
  const owners = useRef(new Map<string, string | undefined>());
  const deferred = useRef<string[]>([]);
  const swallowPops = useRef(0);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settledQueue = useRef<(() => void)[]>([]);

  const currentEntry = () => window.history.state?.overlay as string | undefined;

  const runSettled = useCallback(() => {
    for (const fn of settledQueue.current.splice(0)) fn();
  }, []);

  const pushEntry = useCallback((key: string) => {
    window.history.pushState({ ...window.history.state, overlay: entryValue(key) }, "");
    pushed.current.push(key);
    if (!owners.current.has(key)) owners.current.set(key, scopes.current.at(-1));
  }, []);

  // Deferred to a task: StrictMode's remount and an overlay replacing another in the same render arrive first.
  const flush = useCallback(() => {
    flushTimer.current = null;
    // Our own back() has not traversed yet, so the current entry is stale; its pop runs this again.
    if (swallowPops.current > 0) return;
    for (const key of closing.current) {
      const owner = owners.current.get(key);
      if (owner !== undefined && !scopes.current.includes(owner)) navigating.current.add(key);
    }
    let steps = 0;
    if (pushed.current.length > 0 && currentEntry() === entryValue(pushed.current.at(-1)!)) {
      // Only while we stand on our own top entry: a navigation that pushed a route entry is never undone.
      while (pushed.current.length > steps) {
        const key = pushed.current[pushed.current.length - 1 - steps];
        if (!closing.current.has(key) || navigating.current.has(key)) break;
        steps += 1;
      }
    }
    pushed.current = pushed.current.filter((key) => !closing.current.has(key));
    for (const key of closing.current) {
      navigating.current.delete(key);
      owners.current.delete(key);
    }
    closing.current.clear();
    if (steps > 0) {
      swallowPops.current += 1;
      if (steps === 1) window.history.back();
      else window.history.go(-steps);
    } else {
      runSettled();
    }
  }, [ runSettled ]);

  const afterOwnTraversal = useCallback(() => {
    if (closing.current.size > 0) flush();
    if (swallowPops.current > 0) return;
    for (const key of deferred.current.splice(0)) {
      if (open.current.some((entry) => entry.key === key) && !pushed.current.includes(key)) pushEntry(key);
    }
    runSettled();
  }, [ flush, pushEntry, runSettled ]);

  const add = useCallback((key: string, dismiss: Dismiss) => {
    open.current = [ ...open.current.filter((entry) => entry.key !== key), { key, dismiss } ];
    if (closing.current.delete(key)) return; // StrictMode remount: the entry is still there.
    if (pushed.current.includes(key) || deferred.current.includes(key)) return;
    if (swallowPops.current > 0) {
      // The traversal still pending would undo a push made now.
      deferred.current.push(key);
      return;
    }
    const top = pushed.current.at(-1);
    if (top !== undefined && closing.current.has(top) && currentEntry() === entryValue(top)) {
      // One overlay replaced another (a drawer swapping its target): take over its entry.
      closing.current.delete(top);
      pushed.current[pushed.current.length - 1] = key;
      owners.current.set(key, owners.current.get(top));
      owners.current.delete(top);
      window.history.replaceState({ ...window.history.state, overlay: entryValue(key) }, "");
      return;
    }
    pushEntry(key);
  }, [ pushEntry ]);

  const remove = useCallback((key: string) => {
    open.current = open.current.filter((entry) => entry.key !== key);
    if (!pushed.current.includes(key)) return;
    closing.current.add(key);
    flushTimer.current ??= setTimeout(flush, 0);
  }, [ flush ]);

  const release = useCallback((key: string) => {
    navigating.current.add(key);
  }, []);

  const closeTop = useCallback((viaNavigation: boolean) => {
    const top = pushed.current.at(-1);
    if (top === undefined || currentEntry() !== entryValue(top)) return false;
    const dismiss = open.current.find((entry) => entry.key === top)?.dismiss.current;
    if (!dismiss) return false;
    if (viaNavigation) navigating.current.add(top);
    dismiss();
    return true;
  }, []);

  const enterScope = useCallback((key: string) => {
    scopes.current = [ ...scopes.current.filter((scope) => scope !== key), key ];
  }, []);

  const leaveScope = useCallback((key: string) => {
    scopes.current = scopes.current.filter((scope) => scope !== key);
  }, []);

  const whenSettled = useCallback((fn: () => void) => {
    if (flushTimer.current === null && swallowPops.current === 0 && closing.current.size === 0) {
      fn();
      return;
    }
    // A traversal that never lands (the page left meanwhile) must not swallow the callback.
    let done = false;
    const once = () => {
      if (done) return;
      done = true;
      clearTimeout(fallback);
      settledQueue.current = settledQueue.current.filter((queued) => queued !== once);
      fn();
    };
    const fallback = setTimeout(once, 1000);
    settledQueue.current.push(once);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const onPopState = () => {
      if (swallowPops.current > 0) {
        swallowPops.current -= 1;
        if (swallowPops.current === 0) afterOwnTraversal();
        return;
      }
      const current = currentEntry();
      const index = current === undefined
        ? -1
        : pushed.current.findIndex((key) => entryValue(key) === current);
      // An entry we do not own (another page's, or a stale one): leave it to the router.
      if (current !== undefined && index === -1) return;
      const left = pushed.current.slice(index + 1);
      if (left.length === 0) return;
      pushed.current = pushed.current.slice(0, index + 1);
      for (const key of [ ...left ].reverse()) {
        open.current.find((entry) => entry.key === key)?.dismiss.current?.();
      }
      // An overlay that refused to close (busy saving) gets its entry back, so the next Back still closes it.
      // This push has no user activation, so Chrome may mark the entry skippable and let a later Back pass over
      // it; that only loses this safety net, it never closes the wrong overlay.
      setTimeout(() => {
        const top = open.current.at(-1);
        if (top && left.includes(top.key) && !pushed.current.includes(top.key)) pushEntry(top.key);
      }, 0);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [ enabled, afterOwnTraversal, pushEntry ]);

  return useMemo(
    () => (enabled ? { add, remove, release, closeTop, enterScope, leaveScope, whenSettled } : null),
    [ enabled, add, remove, release, closeTop, enterScope, leaveScope, whenSettled ],
  );
}

export function FocusTrapProvider({ children, dismissOnBack = false }: {
  children: ReactNode;
  /** Back closes the top overlay (provider portal). Off for public pages, which manage their own history. */
  dismissOnBack?: boolean;
}) {
  // A ref, not state: the provider can unmount together with its dialog, and an update queued then never runs.
  const openCount = useRef(0);
  const savedScrollYRef = useRef(0);
  const idCounter = useRef(0);
  const back = useBackEntries(dismissOnBack);

  const register = useCallback(() => {
    if (openCount.current === 0) {
      savedScrollYRef.current = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${savedScrollYRef.current}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.overflow = "hidden";
    }
    openCount.current += 1;
    return idCounter.current++;
  }, []);

  const unregister = useCallback(() => {
    openCount.current -= 1;
    if (openCount.current === 0) {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      window.scrollTo(0, savedScrollYRef.current);
    }
  }, []);

  const value = useMemo(() => ({ register, unregister, back }), [ register, unregister, back ]);

  return (
    <FocusTrapContext.Provider value={value}>
      {children}
    </FocusTrapContext.Provider>
  );
}

/**
 * While `active`, the browser's Back button calls `onDismiss` (only under `<FocusTrapProvider dismissOnBack>`;
 * otherwise a no-op). Call `release()` just before closing because of a navigation that replaces the entry.
 */
export function useBackDismiss(active: boolean, onDismiss: () => void) {
  const back = useContext(FocusTrapContext)?.back ?? null;
  const key = useId();
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });

  useEffect(() => {
    if (!active || !back) return;
    back.add(key, dismiss);
    return () => back.remove(key);
  }, [ active, back, key ]);

  const release = useCallback(() => back?.release(key), [ back, key ]);
  return { release };
}

/**
 * Defers work until the overlays have finished closing: an overlay that closes goes back() over its own history
 * entry on a later task, and a URL write made before that traversal lands (nuqs's replaceState) would be written
 * onto the overlay's entry and popped away with it. Without `dismissOnBack` it runs `fn` at once.
 */
export function useAfterOverlaysSettle() {
  const back = useContext(FocusTrapContext)?.back ?? null;
  return useCallback((fn: () => void) => {
    if (back) back.whenSettled(fn);
    else fn();
  }, [ back ]);
}

/**
 * Marks a page (PageLayout). An overlay opened while it is mounted that closes because the page unmounted never
 * goes back: the app is leaving the page, and going back would cancel that navigation (logout, expired session).
 */
export function useBackScope() {
  const back = useContext(FocusTrapContext)?.back ?? null;
  const key = useId();
  useEffect(() => {
    if (!back) return;
    back.enterScope(key);
    return () => back.leaveScope(key);
  }, [ back, key ]);
}

/**
 * For links inside an overlay: dismisses the top overlay when we stand on its history entry and reports whether
 * it did. With `viaNavigation` its entry is left for the navigation to replace.
 */
export function useCloseTopOverlay() {
  const back = useContext(FocusTrapContext)?.back ?? null;
  return useCallback((viaNavigation: boolean) => back?.closeTop(viaNavigation) ?? false, [ back ]);
}

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  onEscape?: () => void,
) {
  const ref = useRef<T>(null);
  const previousFocus = useRef<Element | null>(null);
  const registrationId = useRef<number | null>(null);
  const ctx = useContext(FocusTrapContext);
  const key = useId();
  const escape = useRef(onEscape);
  useEffect(() => {
    escape.current = onEscape;
  });

  if (!ctx) {
    throw new Error("useFocusTrap must be used within a FocusTrapProvider");
  }
  const { register, unregister, back } = ctx;

  useEffect(() => {
    previousFocus.current = document.activeElement;

    const el = ref.current;
    if (!el) return;

    const first = el.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    // The entry before the lock: pushState saves the page's scroll into the entry it leaves, and a locked body
    // reads 0, which the browser would then restore when the overlay's entry is popped.
    const withBack = back !== null && escape.current !== undefined;
    if (withBack) back.add(key, escape);
    registrationId.current = register();

    return () => {
      if (withBack) back.remove(key);

      if (registrationId.current !== null) {
        unregister();
      }

      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus();
      }
    };
  }, [register, unregister, back, key]);

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
