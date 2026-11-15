"use client";

import PageLayout from "@/src/components/PageLayout";
import { AuditLogsView } from "@/src/components/AuditLogs/AuditLogsView";

export default function ActivityPage() {
    return (
        <PageLayout>
            <AuditLogsView />
        </PageLayout>
    );
}
