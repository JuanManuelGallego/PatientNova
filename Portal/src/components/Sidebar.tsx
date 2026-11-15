"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuthContext } from "@/src/providers/AuthContext";
import { NAV_ICONS } from "@/src/config/icons";
import { UserMenu } from "@/src/components/UserMenu";
import { usePendingRequests } from "@/src/providers/PendingRequestsContext";
import { NAV_GROUPS, isNavItemActive, visibleGroups, type NavContext, type NavItem } from "@/src/config/navigation";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthContext();
  const inbox = usePendingRequests();
  const navContext: NavContext = { user, inboxEnabled: inbox.enabled };

  function renderItem(item: NavItem) {
    const isActive = isNavItemActive(pathname, item.path);
    const Icon = NAV_ICONS[item.id];
    return (
      <Link
        key={item.id}
        href={item.path}
        onClick={onClose}
        aria-current={isActive ? "page" : undefined}
        data-testid={`sidebar-link-${item.id}`}
      >
        <div className={`nav-item ${isActive ? "active" : ""}`}>
          <Icon size={18} />
          {item.label}
          {item.id === "requests" && inbox.pending > 0 && (
            <span className="nav-badge" data-testid="sidebar-requests-badge">
              <span aria-hidden="true">{inbox.pending > 99 ? "99+" : inbox.pending}</span>
              <span className="sr-only">, {inbox.pending} pendientes</span>
            </span>
          )}
        </div>
      </Link>
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
      <nav className="sidebar-nav" aria-label="Secciones" data-testid="sidebar-nav">
        {visibleGroups(NAV_GROUPS, navContext).map((group) => (
          <div key={group.id} className="sidebar-group" role="group" aria-labelledby={group.label ? `sidebar-group-${group.id}` : undefined}>
            {group.label && (
              <div id={`sidebar-group-${group.id}`} className="sidebar-group-label">{group.label}</div>
            )}
            {group.items.map(renderItem)}
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="sidebar-user" data-testid="sidebar-user">
        <UserMenu onNavigate={onClose} drawerOpen={isOpen} />
      </div>
    </aside>
  );
}
