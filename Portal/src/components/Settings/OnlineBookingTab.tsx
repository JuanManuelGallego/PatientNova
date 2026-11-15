"use client";

import { useEffect, useState } from "react";
import { useFetchBookingSettings } from "@/src/api/booking/useFetchBookingSettings";
import { useUpdateBookingSettings } from "@/src/api/booking/useUpdateBookingSettings";
import { BookingSettings } from "@/src/types/Booking";
import { InlineError } from "@/src/components/Info/InlineError";
import { useSettingsAttention } from "@/src/providers/SettingsAttentionContext";
import { ERR_LOAD, ERR_SAVE, LBL_LOADING } from "@/src/constants/ui";
import { OverviewSection } from "./OnlineBooking/OverviewSection";
import { ApprovalSection } from "./OnlineBooking/ApprovalSection";
import { AvailabilitySection } from "./OnlineBooking/AvailabilitySection";
import { PublicProfileSection } from "./OnlineBooking/PublicProfileSection";
import { RulesSection } from "./OnlineBooking/RulesSection";

export function OnlineBookingTab() {
    const { settings, loading, error, fetchSettings } = useFetchBookingSettings();
    const { updateSettings } = useUpdateBookingSettings();

    const [ latest, setCurrent ] = useState<BookingSettings | undefined>(undefined);
    const current = latest ?? settings;

    const [ statusError, setStatusError ] = useState<string | null>(null);

    const { report } = useSettingsAttention();
    const needsAttention = current ? current.bookingEnabled && !current.live : undefined;
    useEffect(() => {
        if (needsAttention !== undefined) report({ booking: needsAttention });
    }, [ needsAttention, report ]);

    if (!current) {
        if (error) return <InlineError message={error || ERR_LOAD} />;
        return <p className="form-input-hint">{loading ? LBL_LOADING : ""}</p>;
    }

    return (
        <div className="settings-stack" data-testid="online-booking-tab">
            <OverviewSection
                settings={current}
                save={updateSettings}
                onSaved={setCurrent}
                onToggle={async (enabled) => {
                    setStatusError(null);
                    try {
                        setCurrent(await updateSettings({ bookingEnabled: enabled }));
                    } catch (err) {
                        setStatusError(err instanceof Error ? err.message : ERR_SAVE);
                    }
                }}
                error={statusError}
            />
            <span className="form-input-hint" style={{ marginTop: -8 }} data-testid="online-booking-autosave-hint">
                Los cambios de esta página se guardan automáticamente.
            </span>
            <AvailabilitySection
                onSaved={async () => {
                    const fresh = await fetchSettings();
                    if (fresh) setCurrent(fresh);
                    else setStatusError(ERR_LOAD);
                }}
            />
            <RulesSection settings={current} save={updateSettings} onSaved={setCurrent} />
            <ApprovalSection settings={current} save={updateSettings} onSaved={setCurrent} />
            <PublicProfileSection settings={current} save={updateSettings} onSaved={setCurrent} />
        </div>
    );
}
