"use client";

import PageLayout from "@/src/components/PageLayout";
import { PageHeader } from "@/src/components/PageHeader";
import { SettingsNav } from "@/src/components/Settings/SettingsNav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageLayout>
            <PageHeader title="Configuración" subtitle="Gestiona tu cuenta y tu consulta" style={{ marginBottom: 28 }} />
            <div className="settings-layout">
                <SettingsNav />
                <div className="settings-content">{children}</div>
            </div>
        </PageLayout>
    );
}
