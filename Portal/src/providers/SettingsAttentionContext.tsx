"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useAuthContext } from "@/src/providers/AuthContext";
import { isAdminRole } from "@/src/types/User";
import { useFetchGoogleConnection } from "@/src/api/google/useFetchGoogleConnection";
import { useFetchBookingSettings } from "@/src/api/booking/useFetchBookingSettings";
import type { GoogleConnectionStatus } from "@/src/types/Google";
import type { SettingsSectionId } from "@/src/config/navigation";

type Reportable = "integrations" | "booking";

interface SettingsAttentionValue {
    sections: ReadonlySet<SettingsSectionId>;
    report: (patch: Partial<Record<Reportable, boolean>>) => void;
    refresh: () => void;
}

const SettingsAttentionContext = createContext<SettingsAttentionValue>({
    sections: new Set(),
    report: () => {},
    refresh: () => {},
});

export function attentionSections(input: {
    googleStatus?: GoogleConnectionStatus[ "status" ];
    booking?: { bookingEnabled: boolean; live: boolean };
}): Set<SettingsSectionId> {
    const sections = new Set<SettingsSectionId>();
    if (input.googleStatus === "expired") sections.add("integrations");
    if (input.booking?.bookingEnabled && !input.booking.live) sections.add("booking");
    return sections;
}

export function SettingsAttentionProvider({ children }: { children: ReactNode }) {
    const { user } = useAuthContext();
    const isAdmin = isAdminRole(user?.role);
    const { data: connection, fetchConnection } = useFetchGoogleConnection(isAdmin);
    const { settings, fetchSettings } = useFetchBookingSettings(isAdmin);
    const [ reported, setReported ] = useState<Partial<Record<Reportable, boolean>>>({});

    const report = useCallback((patch: Partial<Record<Reportable, boolean>>) => {
        setReported((prev) => ({ ...prev, ...patch }));
    }, []);

    const refresh = useCallback(() => {
        setReported({});
        void fetchConnection();
        void fetchSettings();
    }, [ fetchConnection, fetchSettings ]);

    const sections = useMemo(() => {
        const fetched = attentionSections({ googleStatus: connection?.status, booking: settings });
        if (!isAdmin) return new Set<SettingsSectionId>();
        for (const key of Object.keys(reported) as Reportable[]) {
            if (reported[ key ]) fetched.add(key);
            else fetched.delete(key);
        }
        return fetched;
    }, [ connection?.status, settings, reported, isAdmin ]);

    const value = useMemo(() => ({ sections, report, refresh }), [ sections, report, refresh ]);
    return <SettingsAttentionContext.Provider value={value}>{children}</SettingsAttentionContext.Provider>;
}

export function useSettingsAttention(): SettingsAttentionValue {
    return useContext(SettingsAttentionContext);
}
