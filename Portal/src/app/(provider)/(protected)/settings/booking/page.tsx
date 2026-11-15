"use client";

import { useAuthContext } from "@/src/providers/AuthContext";
import { OnlineBookingTab } from "@/src/components/Settings/OnlineBookingTab";
import { EmptyState } from "@/src/components/EmptyState";
import { DETAIL_ICONS } from "@/src/config/icons";

export default function BookingSettingsPage() {
    const { user } = useAuthContext();
    if (user?.portalEnabled) return <OnlineBookingTab />;
    return (
        <div className="dash-card" data-testid="settings-booking-unavailable">
            <EmptyState
                icon={DETAIL_ICONS.link}
                title="Reserva en línea no disponible"
                sub="La reserva en línea no está activada para tu cuenta."
            />
        </div>
    );
}
