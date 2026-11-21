"use client";

import type { MouseEvent } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuthContext } from "@/src/providers/AuthContext";
import { NAV_ICONS } from "@/src/config/icons";
import { UserMenu } from "@/src/components/UserMenu";
import { usePendingRequests } from "@/src/providers/PendingRequestsContext";
import { useSettingsAttention } from "@/src/providers/SettingsAttentionContext";
import { AttentionDot } from "@/src/components/Info/AttentionDot";
import { NAV_GROUPS, visibleGroups, type NavContext, type NavItem } from "@/src/config/navigation";
import { NavGroupList } from "@/src/components/NavGroupList";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  /** Runs on a link click; defaults to `onClose`. */
  onNavigate?: (event?: MouseEvent<HTMLAnchorElement>) => void;
  /** Links replace the current history entry (the open mobile menu's own entry). */
  replaceOnNavigate?: boolean;
}

export default function Sidebar({ isOpen, onClose, onNavigate = onClose, replaceOnNavigate = false }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthContext();
  const inbox = usePendingRequests();
  const attention = useSettingsAttention();
  const navContext: NavContext = { user, inboxEnabled: inbox.enabled };

  function badge(item: NavItem) {
    if (item.id === "settings") return attention.sections.size > 0 ? <AttentionDot testId="sidebar-settings-attention" /> : null;
    if (item.id !== "requests" || inbox.pending === 0) return null;
    return (
      <span className="nav-badge" data-testid="sidebar-requests-badge">
        <span aria-hidden="true">{inbox.pending > 99 ? "99+" : inbox.pending}</span>
        <span className="sr-only">, {inbox.pending} pendientes</span>
      </span>
    );
  }

  return (
    <aside
      className={`sidebar ${isOpen ? "sidebar--open" : ""}`}
      aria-label="Navegación principal"
      data-testid="sidebar"
    >
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand__inner">
          <Image
            src="/favicon.ico"
            alt="Patient Nova"
            width={36}
            height={36}
            sizes="36px"
            style={{ borderRadius: "var(--r-lg)" }}
          />
          <div>
            <div className="sidebar-brand__name">Patient Nova</div>
            <div className="sidebar-brand__tagline">Gestión de pacientes</div>
          </div>
        </div>
      </div>
      <div className="sidebar-divider" />

      {/* Navigation */}
      <NavGroupList
        groups={visibleGroups(NAV_GROUPS, navContext)}
        pathname={pathname}
        onNavigate={onNavigate}
        replace={replaceOnNavigate}
        testIdPrefix="sidebar-link"
        ariaLabel="Secciones"
        className="sidebar-nav"
        testId="sidebar-nav"
        icon={(id) => NAV_ICONS[ id ]}
        badge={badge}
      />

      {/* User section */}
      <div className="sidebar-user" data-testid="sidebar-user">
        <UserMenu onNavigate={onNavigate} replace={replaceOnNavigate} drawerOpen={isOpen} />
      </div>
    </aside>
  );
}
