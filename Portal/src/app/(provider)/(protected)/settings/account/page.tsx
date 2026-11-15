"use client";

import { AccountProfile } from "@/src/components/Settings/AccountProfile";
import { SecurityTab } from "@/src/components/Settings/SecurityTab";

export default function AccountSettingsPage() {
    return (
        <div className="settings-stack">
            <AccountProfile />
            <SecurityTab />
        </div>
    );
}
