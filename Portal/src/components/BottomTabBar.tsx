"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthContext } from "@/src/providers/AuthContext";
import { usePendingRequests } from "@/src/providers/PendingRequestsContext";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import { NAV_ICONS } from "@/src/config/icons";
import { DESKTOP_NAV_QUERY, isNavItemActive, tabBarItems } from "@/src/config/navigation";
import { isPlainClick } from "@/src/components/OverlayLink";
import { PendingCountBadge, pendingCountText } from "@/src/components/Info/PendingCountBadge";

/** Tapping the tab of the page already shown goes back to its top, as in native apps, instead of reloading it. */
function scrollToTopIfHere(event: MouseEvent<HTMLAnchorElement>) {
    if (!isPlainClick(event) || event.currentTarget.href !== window.location.href) return;
    event.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}

/**
 * Phone and tablet navigation (below 1024px, where the sidebar becomes the hamburger menu): the screens
 * used all day, one tap away. Everything else stays in the menu. Its links push history entries as usual:
 * while the menu is open (and holds a history entry) its backdrop covers the bar and `inert` keeps the
 * keyboard out, so no tab can push over that entry.
 */
export function BottomTabBar({ inert = false }: { inert?: boolean }) {
    const pathname = usePathname();
    const { user } = useAuthContext();
    const inbox = usePendingRequests();
    const isDesktop = useMediaQuery(DESKTOP_NAV_QUERY);

    if (isDesktop) return null;

    const items = tabBarItems({ user, inboxEnabled: inbox.enabled });

    return (
        <nav className="bottom-tabbar" aria-label="Accesos directos" data-testid="bottom-tabbar" inert={inert}>
            <ul className="bottom-tabbar__list">
                {items.map((item) => {
                    const Icon = NAV_ICONS[ item.id ];
                    const active = isNavItemActive(pathname, item.path);
                    const pending = item.id === "requests" ? inbox.pending : 0;
                    return (
                        <li key={item.id} className="bottom-tabbar__cell">
                            <Link
                                href={item.href ?? item.path}
                                onClick={scrollToTopIfHere}
                                aria-current={active ? "page" : undefined}
                                className={`bottom-tabbar__tab ${active ? "bottom-tabbar__tab--active" : ""}`}
                                data-testid={`tabbar-link-${item.id}`}
                            >
                                <span className="bottom-tabbar__icon">
                                    <Icon size={22} aria-hidden="true" />
                                    <PendingCountBadge count={pending} testId="tabbar-requests-badge" className="bottom-tabbar__badge" announce={false} />
                                </span>
                                <span className="bottom-tabbar__label">{item.label}</span>
                                {pending > 0 && <span className="sr-only">{pendingCountText(pending)}</span>}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
