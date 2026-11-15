"use client";

import PageLayout from "@/src/components/PageLayout";
import { PageHeader } from "@/src/components/PageHeader";
import { AuditLogsView } from "@/src/components/AuditLogs/AuditLogsView";

export default function ActivityPage() {
    return (
        <PageLayout>
            <PageHeader
                title="Actividad"
                subtitle="Historial de acciones realizadas en el sistema"
                style={{ marginBottom: 28 }}
            />
            <AuditLogsView />
        </PageLayout>
    );
}
