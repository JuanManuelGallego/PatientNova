"use client";

import PageLayout from "@/src/components/PageLayout";
import { PageHeader } from "@/src/components/PageHeader";
import { EmptyState } from "@/src/components/EmptyState";
import { UsersView } from "@/src/components/Admin/UsersView";
import { useAuthContext } from "@/src/providers/AuthContext";
import { NAV_ICONS } from "@/src/config/icons";
import { isSuperAdmin } from "@/src/types/User";

export default function AdminUsersPage() {
    const { user } = useAuthContext();
    return (
        <PageLayout>
            <PageHeader
                title="Usuarios"
                subtitle="Cuentas de los profesionales que usan Patient Nova"
                style={{ marginBottom: 28 }}
            />
            {isSuperAdmin(user?.role) ? (
                <UsersView />
            ) : (
                <EmptyState
                    icon={NAV_ICONS.users}
                    title="No tienes acceso a esta página"
                    sub="Solo un superadministrador puede gestionar usuarios."
                />
            )}
        </PageLayout>
    );
}
