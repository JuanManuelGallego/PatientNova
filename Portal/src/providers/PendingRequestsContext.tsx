"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useAuthContext } from "@/src/providers/AuthContext";
import { AdminRole } from "@/src/types/User";
import { useFetchPendingRequestsCount } from "@/src/api/booking-requests/useFetchPendingRequestsCount";

const REFRESH_MS = 2 * 60_000;

interface PendingRequestsValue {
  /** Whether this user sees the inbox at all: an admin with the portal on (VIEWER would get 403). */
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
  const enabled = !!user?.portalEnabled && (user.role === AdminRole.ADMIN || user.role === AdminRole.SUPER_ADMIN);
  const { pending, refetch } = useFetchPendingRequestsCount(enabled);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => { void refetch(); }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [ enabled, refetch ]);

  return (
    <PendingRequestsContext.Provider value={{ enabled, pending: enabled ? pending : 0, refetch }}>
      {children}
    </PendingRequestsContext.Provider>
  );
}

export const usePendingRequests = () => useContext(PendingRequestsContext);
