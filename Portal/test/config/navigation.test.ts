import { describe, expect, it } from "vitest";
import {
    NAV_GROUPS,
    SETTINGS_NAV,
    settingsHref,
    settingsSectionOf,
    activityHref,
    isNavItemActive,
    visibleGroups,
    tabBarItems,
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

    it("shows Usuarios only to a super admin", () => {
        const admin = visibleGroups(NAV_GROUPS, ctx(AdminRole.SUPER_ADMIN, false)).find((g) => g.id === "admin");
        expect(admin?.items.map((i) => i.id)).toEqual([ "activity", "users", "settings" ]);
    });

    it("hides Actividad when there is no user", () => {
        const admin = visibleGroups(NAV_GROUPS, ctx(null, false)).find((g) => g.id === "admin");
        expect(admin?.items.map((i) => i.id)).toEqual([ "settings" ]);
    });
});

describe("labels", () => {
    it("uses sentence-case Spanish labels in menu order", () => {
        expect(NAV_GROUPS.flatMap((g) => g.items).map((i) => i.label)).toEqual([
            "Vista general", "Pacientes", "Historias clínicas", "Citas", "Calendario", "Recordatorios", "Solicitudes", "Actividad", "Usuarios", "Configuración",
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

describe("settings navigation", () => {
    it("addresses settings sections by English path, with an optional anchor", () => {
        expect(settingsHref("services")).toBe("/settings/services");
        expect(settingsHref("services", "locations")).toBe("/settings/services#locations");
    });

    it("lists the settings menu in spec order with Spanish labels", () => {
        expect(SETTINGS_NAV.map((g) => g.label)).toEqual([ "Tu cuenta", "Tu consulta", "Conexiones" ]);
        expect(SETTINGS_NAV.flatMap((g) => g.items).map((i) => i.label)).toEqual([
            "Cuenta", "Notificaciones", "Consultorio", "Servicios", "Reserva en línea", "Integraciones",
        ]);
    });

    it("hides Reserva en línea without the portal", () => {
        const visible = (portalEnabled: boolean) =>
            visibleGroups(SETTINGS_NAV, { user: { portalEnabled } as User, inboxEnabled: false }).flatMap((g) => g.items).map((i) => i.id);
        expect(visible(false)).not.toContain("booking");
        expect(visible(true)).toContain("booking");
    });

    it.each([
        [ "/settings/services", "services" ],
        [ "/settings/account", "account" ],
        [ "/settings", null ],
        [ "/settingsx", null ],
    ])("finds the section of %s", (pathname, id) => {
        expect(settingsSectionOf(pathname)).toBe(id);
    });
});

describe("tabBarItems", () => {
    const sidebarIds = (c: NavContext) => visibleGroups(NAV_GROUPS, c).flatMap((g) => g.items).map((i) => i.id);

    it("gives an admin with the inbox the five tabs in order, with one-word labels", () => {
        const items = tabBarItems(ctx(AdminRole.ADMIN, true));
        expect(items.map((i) => i.id)).toEqual([ "calendar", "appointments", "patients", "requests", "reminders" ]);
        expect(items.map((i) => i.label)).toEqual([ "Calendario", "Citas", "Pacientes", "Solicitudes", "Recordatorios" ]);
        expect(items.map((i) => i.path)).toEqual([ "/calendar", "/appointments", "/patients", "/requests", "/reminders" ]);
    });

    it("drops Solicitudes exactly when the sidebar does", () => {
        expect(tabBarItems(ctx(AdminRole.VIEWER, false)).map((i) => i.id)).toEqual([ "calendar", "appointments", "patients", "reminders" ]);
        expect(tabBarItems(ctx(AdminRole.ADMIN, false)).map((i) => i.id)).not.toContain("requests");
    });

    it.each([
        [ AdminRole.VIEWER, false ], [ AdminRole.VIEWER, true ], [ AdminRole.ADMIN, false ], [ AdminRole.ADMIN, true ],
        [ AdminRole.SUPER_ADMIN, true ], [ null, false ],
    ] as const)("shows only items the sidebar shows (%s, inbox %s)", (role, inbox) => {
        const c = ctx(role, inbox);
        const visible = sidebarIds(c);
        for (const item of tabBarItems(c)) expect(visible).toContain(item.id);
    });

    it("keeps every label to a single word", () => {
        for (const item of tabBarItems(ctx(AdminRole.SUPER_ADMIN, true))) expect(item.label).toMatch(/^\S+$/);
    });
});
