"use client";

import { useState, useEffect, useCallback, type MouseEvent } from "react";
import Image from "next/image";
import Sidebar from "@/src/components/Sidebar";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import { useBackDismiss, useBackScope } from "@/src/hooks/useFocusTrap";
import { isPlainClick } from "@/src/components/OverlayLink";
import { ACTION_ICONS } from "@/src/config/icons";
import { ProviderAlerts } from "@/src/components/Info/ProviderAlerts";
import { BottomTabBar } from "@/src/components/BottomTabBar";
import { DESKTOP_NAV_QUERY } from "@/src/config/navigation";
import { theme } from "@/src/config/theme";
import { useTheme } from "@/src/providers/ThemeContext";

/** Wraps the standard page-shell (sidebar + navbar + main content area). */
export default function PageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isDesktop = useMediaQuery(DESKTOP_NAV_QUERY);
  const MenuIcon = ACTION_ICONS.menu;
  const { isDark } = useTheme();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

  // Overlays of this page never go back once it unmounts (logout, leaving through a link).
  useBackScope();
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Below 1024px the open menu is an overlay: Back closes it instead of leaving the page. Declared before the
  // scroll lock so its entry is pushed first, while the page's scroll can still be saved into the entry it leaves.
  const menuOverlay = sidebarOpen && !isDesktop;
  const { release } = useBackDismiss(menuOverlay, closeSidebar);

  useEffect(() => {
    if (sidebarOpen && !isDesktop) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.overflow = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [sidebarOpen, isDesktop]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [sidebarOpen]);

  // While the menu holds a history entry its links replace that entry, so Back from the next page returns here.
  const navigateFromSidebar = useCallback((event?: MouseEvent<HTMLAnchorElement>) => {
    const link = event?.currentTarget;
    if (menuOverlay && link && isPlainClick(event)) {
      if (link.href === window.location.href) event.preventDefault(); // Already here: just close.
      else release(); // The navigation takes over the entry; going back would race it.
    }
    setSidebarOpen(false);
  }, [ menuOverlay, release ]);

  return (
    <div className="page-shell">
      {/* The browser and status bar take the top bar's colour in the provider's theme (React hoists it to <head>). */}
      <meta name="theme-color" content={isDark ? theme.themeColor.dark : theme.themeColor.light} />
      {sidebarOpen && !isDesktop && (
        <div
          className="sidebar-backdrop"
          onClick={closeSidebar}
          aria-hidden="true"
          data-testid="sidebar-backdrop"
        />
      )}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        onNavigate={navigateFromSidebar}
        replaceOnNavigate={menuOverlay}
      />
      <div className="page-content-wrapper">
        <header className="top-navbar">
          <button
            className="navbar-hamburger"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Abrir menú"
            aria-expanded={sidebarOpen}
            data-testid="hamburger-button"
          >
            <MenuIcon size={22} />
          </button>
          <div className="navbar-brand">
            <Image
              src="/favicon.ico"
              alt="Patient Nova"
              width={28}
              height={28}
              sizes="28px"
              style={{ borderRadius: "var(--r-md)" }}
            />
            <span className="navbar-brand__text">Patient Nova</span>
          </div>
          <div className="navbar-spacer" />
        </header>
        <main className="page-main">
          <ProviderAlerts />
          {children}
        </main>
      </div>
      {/* Below 1024px; stacked under the menu's backdrop and every modal, drawer and sheet. */}
      <BottomTabBar inert={menuOverlay} />
    </div>
  );
}

