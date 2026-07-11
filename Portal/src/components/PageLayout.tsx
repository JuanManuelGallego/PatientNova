"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Sidebar from "@/src/components/Sidebar";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import { ACTION_ICONS } from "@/src/config/icons";

/** Wraps the standard page-shell (sidebar + navbar + main content area). */
export default function PageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const MenuIcon = ACTION_ICONS.menu;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

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

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="page-shell">
      {sidebarOpen && !isDesktop && (
        <div
          className="sidebar-backdrop"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <div className="page-content-wrapper">
        <header className="top-navbar">
          <button
            className="navbar-hamburger"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Abrir menú"
            aria-expanded={sidebarOpen}
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
        <main className="page-main">{children}</main>
      </div>
    </div>
  );
}
