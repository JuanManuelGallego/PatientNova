import { describe, expect, it } from "vitest";
import {
    NAV_GROUPS,
    activityHref,
    isNavItemActive,
    visibleGroups,
    type NavContext,
} from "@/src/config/navigation";
import { AdminRole, isAdminRole, type User } from "@/src/types/User";

const ctx = (role: AdminRole | null, inboxEnabled: boolean): NavContext => ({
    user: role ? ({ role } as User) : null,
    inboxEnabled,
});

describe("isNavItemActive", () => {
    it.each([
        [ "/settings", "/settings", true ],
        [ "/settings/account", "/settings", true ],
        [ "/patientsx", "/patients", false ],
        [ "/", "/patients", false ],
    ])("%s against %s is %s", (pathname, path, expected) => {
        expect(isNavItemActive(pathname, path)).toBe(expected);
    });
});

describe("visibleGroups", () => {
    it("leaves a viewer without the inbox only Configuración under Administración", () => {
        const groups = visibleGroups(NAV_GROUPS, ctx(AdminRole.VIEWER, false));
        expect(groups.find((g) => g.id === "admin")?.items.map((i) => i.id)).toEqual([ "settings" ]);
        expect(groups.flatMap((g) => g.items).some((i) => i.id === "requests")).toBe(false);
    });

    it("shows Actividad and the inbox to an admin with the inbox", () => {
        const groups = visibleGroups(NAV_GROUPS, ctx(AdminRole.ADMIN, true));
        const admin = groups.find((g) => g.id === "admin");
        expect(admin?.label).toBe("Administración");
        expect(admin?.items.map((i) => i.id)).toEqual([ "activity", "settings" ]);
        expect(groups.find((g) => g.id === "clinic")?.items.map((i) => i.id)).toContain("requests");
    });

    it("hides Actividad when there is no user", () => {
        const admin = visibleGroups(NAV_GROUPS, ctx(null, false)).find((g) => g.id === "admin");
        expect(admin?.items.map((i) => i.id)).toEqual([ "settings" ]);
    });
});

describe("labels", () => {
    it("uses sentence-case Spanish labels in menu order", () => {
        expect(NAV_GROUPS.flatMap((g) => g.items).map((i) => i.label)).toEqual([
            "Vista general", "Pacientes", "Historias clínicas", "Citas", "Calendario", "Recordatorios", "Solicitudes", "Actividad", "Configuración",
        ]);
    });
});

describe("activityHref", () => {
    it("builds filtered links to the activity page", () => {
        expect(activityHref({ entityId: "r1" })).toBe("/activity?entityId=r1");
        expect(activityHref({ portalPatientId: "p 1" })).toBe("/activity?portalPatientId=p+1");
        expect(activityHref({})).toBe("/activity");
    });
});

describe("isAdminRole", () => {
    it("is true only for ADMIN and SUPER_ADMIN", () => {
        expect(isAdminRole(AdminRole.ADMIN)).toBe(true);
        expect(isAdminRole(AdminRole.SUPER_ADMIN)).toBe(true);
        expect(isAdminRole(AdminRole.VIEWER)).toBe(false);
        expect(isAdminRole(undefined)).toBe(false);
    });
});
