"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuthContext } from "@/src/providers/AuthContext";
import { useSettingsAttention } from "@/src/providers/SettingsAttentionContext";
import { AttentionDot } from "@/src/components/Info/AttentionDot";
import { NavGroupList } from "@/src/components/NavGroupList";
import { SETTINGS_NAV, settingsHref, settingsSectionOf, visibleGroups, type SettingsSectionId } from "@/src/config/navigation";

export function SettingsNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useAuthContext();
    const { sections } = useSettingsAttention();
    const groups = visibleGroups(SETTINGS_NAV, { user, inboxEnabled: false });
    const section = settingsSectionOf(pathname);
    const current = section && groups.some((g) => g.items.some((i) => i.id === section)) ? section : "";

    return (
        <>
            <NavGroupList
                groups={groups}
                pathname={pathname}
                testIdPrefix="settings-nav"
                ariaLabel="Secciones de configuración"
                className="settings-nav"
                badge={(item) => (sections.has(item.id) ? <AttentionDot testId={`settings-nav-${item.id}-attention`} /> : null)}
            />
            <select
                className="form-input settings-nav-select"
                aria-label="Sección de configuración"
                data-testid="settings-nav-select"
                value={current}
                onChange={(e) => router.push(settingsHref(e.target.value as SettingsSectionId))}
            >
                {current === "" && <option value="" disabled>Elige una sección</option>}
                {groups.map((group) => (
                    <optgroup key={group.id} label={group.label}>
                        {group.items.map((item) => (
                            <option key={item.id} value={item.id}>
                                {sections.has(item.id) ? `${item.label} (requiere atención)` : item.label}
                            </option>
                        ))}
                    </optgroup>
                ))}
            </select>
        </>
    );
}
