"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useAuthContext } from "@/src/providers/AuthContext";
import { isAdminRole } from "@/src/types/User";
import { useFetchPendingRequestsCount } from "@/src/api/booking-requests/useFetchPendingRequestsCount";

const REFRESH_MS = 2 * 60_000;

interface PendingRequestsValue {
  /** Whether this user sees the inbox at all: an admin (VIEWER would get 403). */
  enabled: boolean;
  pending: number;
  refetch: () => Promise<unknown>;
}

const PendingRequestsContext = createContext<PendingRequestsValue>({
  enabled: false,
  pending: 0,
  refetch: async () => undefined,
});

/** One shared count for the sidebar badge, the alert and the dashboard card, refreshed every two minutes. */
export function PendingRequestsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const enabled = isAdminRole(user?.role);
  const { pending, refetch } = useFetchPendingRequestsCount(enabled);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refetch();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [ enabled, refetch ]);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => { if (document.visibilityState === "visible") void refetch(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [ enabled, refetch ]);

  return (
    <PendingRequestsContext.Provider value={{ enabled, pending: enabled ? pending : 0, refetch }}>
      {children}
    </PendingRequestsContext.Provider>
  );
}

export const usePendingRequests = () => useContext(PendingRequestsContext);
