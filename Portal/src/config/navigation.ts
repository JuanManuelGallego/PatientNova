import { isAdminRole, isSuperAdmin, type User } from "@/src/types/User";

/**
 * Provider navigation: the one source the sidebar renders. Add a page here,
 * with its `visible` rule, instead of special-casing it in `Sidebar`.
 */

export type NavItemId =
    | "dashboard"
    | "patients"
    | "medical-records"
    | "appointments"
    | "calendar"
    | "reminders"
    | "requests"
    | "activity"
    | "users"
    | "settings";

export interface NavContext {
    user: User | null;
    /** The booking-request inbox is on for this user (admin with the portal enabled). */
    inboxEnabled: boolean;
}

export interface NavItem<Id extends string = NavItemId> {
    id: Id;
    path: string;
    href?: string;
    label: string;
    visible?: (ctx: NavContext) => boolean;
}

export interface NavGroup<Id extends string = NavItemId> {
    id: string;
    label?: string;
    items: NavItem<Id>[];
}

export const ACTIVITY_PATH = "/activity";
export const ADMIN_USERS_PATH = "/admin/users";
/** Where "Mi cuenta" leads. */
export const ACCOUNT_PATH = "/settings/account";

/** The sidebar, top to bottom. */
export const NAV_GROUPS: NavGroup[] = [
    {
        id: "main",
        items: [ { id: "dashboard", path: "/dashboard", label: "Vista general" } ],
    },
    {
        id: "clinic",
        label: "Consulta",
        items: [
            { id: "patients", path: "/patients", label: "Pacientes" },
            { id: "medical-records", path: "/medical-records", label: "Historias clínicas" },
            { id: "appointments", path: "/appointments", label: "Citas" },
            { id: "calendar", path: "/calendar", label: "Calendario" },
            { id: "reminders", path: "/reminders", label: "Recordatorios" },
            { id: "requests", path: "/requests", label: "Solicitudes", visible: (ctx) => ctx.inboxEnabled },
        ],
    },
    {
        id: "admin",
        label: "Administración",
        items: [
            { id: "activity", path: ACTIVITY_PATH, label: "Actividad", visible: (ctx) => isAdminRole(ctx.user?.role) },
            { id: "users", path: ADMIN_USERS_PATH, label: "Usuarios", visible: (ctx) => isSuperAdmin(ctx.user?.role) },
            { id: "settings", path: "/settings", href: settingsHref("account"), label: "Configuración" },
        ],
    },
];

const isVisible = <Id extends string>(item: NavItem<Id>, ctx: NavContext) => !item.visible || item.visible(ctx);

/** Drops hidden items, then groups left empty. */
export function visibleGroups<Id extends string>(groups: NavGroup<Id>[], ctx: NavContext): NavGroup<Id>[] {
    return groups
        .map((group) => ({ ...group, items: group.items.filter((item) => isVisible(item, ctx)) }))
        .filter((group) => group.items.length > 0);
}

/** Active on the page itself and on any sub-route, never on a sibling sharing a prefix. */
export function isNavItemActive(pathname: string, path: string): boolean {
    return pathname === path || pathname.startsWith(`${path}/`);
}

export function activityHref(filter: { entityId?: string; portalPatientId?: string }): string {
    const params = new URLSearchParams();
    if (filter.entityId) params.set("entityId", filter.entityId);
    if (filter.portalPatientId) params.set("portalPatientId", filter.portalPatientId);
    const query = params.toString();
    return query ? `${ACTIVITY_PATH}?${query}` : ACTIVITY_PATH;
}

export type SettingsSectionId = "account" | "notifications" | "practice" | "services" | "booking" | "integrations";

export function settingsHref(id: SettingsSectionId, anchor?: string): string {
    return `/settings/${id}${anchor ? `#${anchor}` : ""}`;
}

export const SETTINGS_NAV: NavGroup<SettingsSectionId>[] = [
    {
        id: "you",
        label: "Tu cuenta",
        items: [
            { id: "account", path: settingsHref("account"), label: "Cuenta" },
            { id: "notifications", path: settingsHref("notifications"), label: "Notificaciones" },
        ],
    },
    {
        id: "clinic",
        label: "Tu consulta",
        items: [
            { id: "practice", path: settingsHref("practice"), label: "Consultorio" },
            { id: "services", path: settingsHref("services"), label: "Servicios" },
            { id: "booking", path: settingsHref("booking"), label: "Reserva en línea", visible: (ctx) => !!ctx.user?.portalEnabled },
        ],
    },
    {
        id: "connections",
        label: "Conexiones",
        items: [ { id: "integrations", path: settingsHref("integrations"), label: "Integraciones" } ],
    },
];

export function settingsSectionOf(pathname: string): SettingsSectionId | null {
    const item = SETTINGS_NAV.flatMap((g) => g.items).find((i) => isNavItemActive(pathname, i.path));
    return item?.id ?? null;
}
