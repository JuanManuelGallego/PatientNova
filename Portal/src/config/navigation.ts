import { isAdminRole, type User } from "@/src/types/User";

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
    | "settings";

export interface NavContext {
    user: User | null;
    /** The booking-request inbox is on for this user (admin with the portal enabled). */
    inboxEnabled: boolean;
}

export interface NavItem {
    id: NavItemId;
    path: string;
    label: string;
    visible?: (ctx: NavContext) => boolean;
}

export interface NavGroup {
    id: string;
    label?: string;
    items: NavItem[];
}

export const ACTIVITY_PATH = "/activity";
/** Where "Mi cuenta" leads. */
export const ACCOUNT_PATH = "/settings";

/** The scrolling part of the sidebar. */
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
        ],
    },
];

/** Pinned below the scrolling list. */
export const NAV_FOOTER: NavItem[] = [
    { id: "settings", path: "/settings", label: "Configuración" },
];

const isVisible = (item: NavItem, ctx: NavContext) => !item.visible || item.visible(ctx);

/** Drops hidden items, then groups left empty. */
export function visibleGroups(groups: NavGroup[], ctx: NavContext): NavGroup[] {
    return groups
        .map((group) => ({ ...group, items: group.items.filter((item) => isVisible(item, ctx)) }))
        .filter((group) => group.items.length > 0);
}

export function visibleItems(items: NavItem[], ctx: NavContext): NavItem[] {
    return items.filter((item) => isVisible(item, ctx));
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
