"use client";

import PageLayout from "@/src/components/PageLayout";
import { PageHeader } from "@/src/components/PageHeader";
import { ProfileTab } from "@/src/components/Settings/ProfileTab";
import { SecurityTab } from "@/src/components/Settings/SecurityTab";
import { LocationsTab } from "@/src/components/Settings/LocationsTab";
import { RemindersTab } from "@/src/components/Settings/RemindersTab";
import { AppointmentTypesTab } from "@/src/components/Settings/AppointmentTypesTab";
import { parseAsStringEnum, useQueryState } from "nuqs";

enum ActiveTab { Profile = "Perfil", Security = "Seguridad", Locations = "Ubicaciones", AppointmentTypes = "Tipos de Cita", Notifications = "Recordatorios" }

export default function SettingsPage() {
    const [ tab, setTab ] = useQueryState("tab", parseAsStringEnum<ActiveTab>(Object.values(ActiveTab)).withDefault(ActiveTab.Profile));

    return (
        <PageLayout>
            <PageHeader
                title="Configuración"
                subtitle="Gestiona tu perfil y seguridad"
                style={{ marginBottom: 28 }}
            />
            <div className="tab-nav" style={{ marginBottom: 28 }}>
                {(Object.values(ActiveTab) as ActiveTab[]).map((t) => (
                    <button
                        key={t}
                        className={`filter-chip${tab === t ? " filter-chip--active" : ""}`}
                        onClick={() => setTab(t)}
                    >
                       {t}
                    </button>
                ))}
            </div>
            {tab === ActiveTab.Profile && (<ProfileTab />)}
            {tab === ActiveTab.Security && (<SecurityTab />)}
            {tab === ActiveTab.Locations && (<LocationsTab />)}
            {tab === ActiveTab.AppointmentTypes && (<AppointmentTypesTab />)}
            {tab === ActiveTab.Notifications && (<RemindersTab />)}
        </PageLayout>
    );
}