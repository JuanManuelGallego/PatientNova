"use client";

import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronUp, Moon, Sun, UserRound } from "lucide-react";
import { useAuthContext } from "@/src/providers/AuthContext";
import { useTheme } from "@/src/providers/ThemeContext";
import { ACTION_ICONS } from "@/src/config/icons";
import { ACCOUNT_PATH } from "@/src/config/navigation";

/**
 * The sidebar's account block: a disclosure button (avatar, name, title)
 * that opens Mi cuenta, the theme switch and Cerrar sesión above it.
 */
export function UserMenu({ onNavigate, replace = false, drawerOpen = false }: {
    onNavigate: (event?: MouseEvent<HTMLAnchorElement>) => void;
    /** Mi cuenta replaces the current history entry (the open mobile menu's own). */
    replace?: boolean;
    drawerOpen?: boolean;
}) {
    const { user, logout } = useAuthContext();
    const { isDark, toggleTheme } = useTheme();
    const router = useRouter();
    const [ open, setOpen ] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelId = useId();
    const LogoutIcon = ACTION_ICONS.logout;

    const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : "";
    const name = user?.displayName || fullName;
    const initials = user ? `${user.firstName?.[ 0 ] ?? ""}${user.lastName?.[ 0 ] ?? ""}`.toUpperCase() || "?" : "?";

    useEffect(() => {
        if (!open) return;
        function handlePointerDown(e: PointerEvent) {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, [ open ]);

    // The sidebar stays mounted on mobile: a closed drawer must not reopen with the menu still out.
    const [ prevDrawerOpen, setPrevDrawerOpen ] = useState(drawerOpen);
    if (drawerOpen !== prevDrawerOpen) {
        setPrevDrawerOpen(drawerOpen);
        if (!drawerOpen) setOpen(false);
    }

    function handleBlur(e: FocusEvent) {
        // Only when focus lands elsewhere (Tab out). A null target is a click that Safari
        // does not focus, which must not close the menu before the click lands.
        const next = e.relatedTarget as Node | null;
        if (next && !rootRef.current?.contains(next)) setOpen(false);
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key !== "Escape" || !open) return;
        // The mobile drawer also closes on Escape (window listener); this Escape is only for the menu.
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
    }

    async function handleLogout() {
        setOpen(false);
        await logout();
        router.replace("/login");
    }

    return (
        <div ref={rootRef} className="sidebar-user-menu" onKeyDown={handleKeyDown} onBlur={handleBlur}>
            <button
                ref={triggerRef}
                type="button"
                className="sidebar-user__inner sidebar-user-menu__trigger"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={() => setOpen((v) => !v)}
                data-testid="sidebar-user-menu-button"
            >
                <span className="sidebar-user__avatar" aria-hidden="true">
                    {user?.avatar ? (
                        <Image
                            src={user.avatar}
                            alt=""
                            width={36}
                            height={36}
                            sizes="36px"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                    ) : initials}
                </span>
                <span className="sidebar-user__info">
                    <span className="sidebar-user__name">{name}</span>
                    {user?.jobTitle && <span className="sidebar-user__role">{user.jobTitle}</span>}
                </span>
                <ChevronUp
                    size={16}
                    aria-hidden="true"
                    className="sidebar-user-menu__chevron"
                    style={{ transform: open ? undefined : "rotate(180deg)" }}
                />
            </button>
            {/* After the trigger so Tab moves into it; CSS places it above. */}
            {open && (
                <div id={panelId} className="sidebar-user-menu__panel">
                    <Link
                        href={ACCOUNT_PATH}
                        className="sidebar-user-menu__item"
                        replace={replace}
                        onClick={(e) => { setOpen(false); onNavigate(e); }}
                        data-testid="sidebar-account-link"
                    >
                        <UserRound size={16} aria-hidden="true" /> Mi cuenta
                    </Link>
                    <button
                        type="button"
                        className="sidebar-user-menu__item"
                        onClick={() => { toggleTheme(); setOpen(false); triggerRef.current?.focus(); }}
                        data-testid="sidebar-theme-toggle"
                    >
                        {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
                        {isDark ? "Tema claro" : "Tema oscuro"}
                    </button>
                    <button
                        type="button"
                        className="sidebar-user-menu__item sidebar-user-menu__item--danger"
                        onClick={handleLogout}
                        data-testid="sidebar-logout"
                    >
                        <LogoutIcon size={16} aria-hidden="true" /> Cerrar sesión
                    </button>
                </div>
            )}
        </div>
    );
}
