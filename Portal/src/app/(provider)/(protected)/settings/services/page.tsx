"use client";

import { useCallback, useState } from "react";
import { AppointmentTypesTab } from "@/src/components/Settings/AppointmentTypesTab";
import { LocationsTab } from "@/src/components/Settings/LocationsTab";
import { useScrollToHashWhenReady } from "@/src/hooks/useScrollToHashWhenReady";

export default function ServicesSettingsPage() {
    const [ typesReady, setTypesReady ] = useState(false);
    const [ locationsReady, setLocationsReady ] = useState(false);
    useScrollToHashWhenReady(typesReady && locationsReady);
    const onTypesReady = useCallback(() => setTypesReady(true), []);
    const onLocationsReady = useCallback(() => setLocationsReady(true), []);

    return (
        <div className="settings-stack">
            <AppointmentTypesTab onReady={onTypesReady} />
            <LocationsTab onReady={onLocationsReady} />
        </div>
    );
}
