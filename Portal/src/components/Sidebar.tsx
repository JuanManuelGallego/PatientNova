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
import { PendingCountBadge } from "@/src/components/Info/PendingCountBadge";
import { NAV_GROUPS, visibleGroups, type NavContext, type NavItem } from "@/src/config/navigation";
import { NavGroupList } from "@/src/components/NavGroupList";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (event?: MouseEvent<HTMLAnchorElement>) => void;
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
    if (item.id !== "requests") return null;
    return <PendingCountBadge count={inbox.pending} testId="sidebar-requests-badge" />;
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
