"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuthContext } from "@/src/app/AuthContext";
import { useTheme } from "@/src/app/ThemeContext";
import { useRouter } from "next/navigation";
import { NAV_ICONS, ACTION_ICONS } from "@/src/config/icons";
import { Moon, Sun } from "lucide-react";

const NAV_ITEMS = [
  { id: "dashboard" as const, path: "/dashboard", label: "Vista General" },
  { id: "patients" as const, path: "/patients", label: "Pacientes" },
  {
    id: "medical-records" as const,
    path: "/medical-records",
    label: "Historias Clinicas",
  },
  { id: "appointments" as const, path: "/appointments", label: "Citas" },
  { id: "calendar" as const, path: "/calendar", label: "Calendario" },
  { id: "reminders" as const, path: "/reminders", label: "Recordatorios" },
  { id: "settings" as const, path: "/settings", label: "Configuración" },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthContext();
  const { isDark, toggleTheme } = useTheme();
  const LogoutIcon = ACTION_ICONS.logout;

  return (
    <aside
      className={`sidebar ${isOpen ? "sidebar--open" : ""}`}
      aria-label="Navegación principal"
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
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.path;
          const Icon = NAV_ICONS[item.id];
          return (
            <Link
              key={item.id}
              href={item.path}
              onClick={onClose}
              aria-current={isActive ? "page" : undefined}
            >
              <div className={`nav-item ${isActive ? "active" : ""}`}>
                <Icon size={18} />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="sidebar-user">
        <div className="sidebar-user__inner">
          <div className="sidebar-user__avatar">
            {user?.avatarUrl ? (
              <Image
                onClick={() => {
                  router.push("/settings");
                }}
                src={user.avatarUrl}
                alt={user.displayName}
                width={36}
                height={36}
                sizes="36px"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : user ? (
              `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
            ) : (
              "?"
            )}
          </div>
          <div className="sidebar-user__info">
            <div className="sidebar-user__name">{user?.displayName ?? "—"}</div>
            <div className="sidebar-user__role">{user?.jobTitle ?? ""}</div>
          </div>
          <button
            onClick={toggleTheme}
            title={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            className="sidebar-logout"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
            title="Cerrar sesión"
            className="sidebar-logout"
          >
            <LogoutIcon size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
