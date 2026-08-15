"use client";

import PageLayout from "@/src/components/PageLayout";
import { PageHeader } from "@/src/components/PageHeader";
import { ProfileTab } from "@/src/components/Settings/ProfileTab";
import { SecurityTab } from "@/src/components/Settings/SecurityTab";
import { LocationsTab } from "@/src/components/Settings/LocationsTab";
import { RemindersTab } from "@/src/components/Settings/RemindersTab";
import { AppointmentTypesTab } from "@/src/components/Settings/AppointmentTypesTab";
import { AuditLogsTab } from "@/src/components/Settings/AuditLogsTab";
import { TabNav } from "@/src/components/TabNav";
import { parseAsStringEnum, useQueryState } from "nuqs";

enum ActiveTab { Profile = "Perfil", Security = "Seguridad", Locations = "Ubicaciones", AppointmentTypes = "Tipos de Cita", Notifications = "Recordatorios", AuditLogs = "Registro de actividad" }

export default function SettingsPage() {
    const [ tab, setTab ] = useQueryState("tab", parseAsStringEnum<ActiveTab>(Object.values(ActiveTab)).withDefault(ActiveTab.Profile));

    return (
        <PageLayout>
            <PageHeader
                title="Configuración"
                subtitle="Gestiona tu perfil y seguridad"
                style={{ marginBottom: 28 }}
            />
            <div style={{ marginBottom: 28 }}>
                <TabNav
                    items={(Object.values(ActiveTab) as ActiveTab[]).map((t) => ({
                        key: t,
                        label: t,
                    }))}
                    active={tab}
                    onSelect={(key) => setTab(key as ActiveTab)}
                    testIdPrefix="settings-tab"
                />
            </div>
            {tab === ActiveTab.Profile && (<ProfileTab />)}
            {tab === ActiveTab.Security && (<SecurityTab />)}
            {tab === ActiveTab.Locations && (<LocationsTab />)}
            {tab === ActiveTab.AppointmentTypes && (<AppointmentTypesTab />)}
            {tab === ActiveTab.Notifications && (<RemindersTab />)}
            {tab === ActiveTab.AuditLogs && (<AuditLogsTab />)}
        </PageLayout>
    );
}