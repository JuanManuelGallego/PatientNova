"use client";

import PageLayout from "@/src/components/PageLayout";
import { PageHeader } from "@/src/components/PageHeader";
import { ProfileTab } from "@/src/components/Settings/ProfileTab";
import { SecurityTab } from "@/src/components/Settings/SecurityTab";
import { LocationsTab } from "@/src/components/Settings/LocationsTab";
import { RemindersTab } from "@/src/components/Settings/RemindersTab";
import { AppointmentTypesTab } from "@/src/components/Settings/AppointmentTypesTab";
import { GoogleIntegrationTab } from "@/src/components/Settings/GoogleIntegrationTab";
import { OnlineBookingTab } from "@/src/components/Settings/OnlineBookingTab";
import { useAuthContext } from "@/src/providers/AuthContext";
import { TabNav } from "@/src/components/TabNav";
import { QUERY_PARAMS } from "@/src/utils/listQuery";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { SettingsTab } from "@/src/config/settingsTabs";


export default function SettingsPage() {
    const { user } = useAuthContext();
    const tabs = (Object.values(SettingsTab) as SettingsTab[]).filter((t) => t !== SettingsTab.OnlineBooking || user?.portalEnabled);
    const [ tab, setTab ] = useQueryState(QUERY_PARAMS.settingsTab, parseAsStringEnum<SettingsTab>(tabs).withDefault(SettingsTab.Profile));

    return (
        <PageLayout>
            <PageHeader
                title="Configuración"
                subtitle="Gestiona tu cuenta y tu consulta"
                style={{ marginBottom: 28 }}
            />
            <div style={{ marginBottom: 28 }}>
                <TabNav
                    items={tabs.map((t) => ({
                        key: t,
                        label: t,
                    }))}
                    active={tab}
                    onSelect={(key) => setTab(key as SettingsTab)}
                    testIdPrefix="settings-tab"
                />
            </div>
            <div className="settings-content">
                {tab === SettingsTab.Profile && (<ProfileTab />)}
                {tab === SettingsTab.Security && (<SecurityTab />)}
                {tab === SettingsTab.Locations && (<LocationsTab />)}
                {tab === SettingsTab.AppointmentTypes && (<AppointmentTypesTab />)}
                {tab === SettingsTab.OnlineBooking && user?.portalEnabled && (<OnlineBookingTab />)}
                {tab === SettingsTab.Integrations && (<GoogleIntegrationTab />)}
                {tab === SettingsTab.Notifications && (<RemindersTab />)}
            </div>
        </PageLayout>
    );
}