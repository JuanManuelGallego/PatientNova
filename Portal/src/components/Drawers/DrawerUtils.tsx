"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import {
  ACTION_ICONS,
  PAGINATION_ICONS,
  STATUS_ICONS,
  type LucideIcon,
} from "@/src/config/icons";
import { useFocusTrap } from "@/src/hooks/useFocusTrap";

type DrawerShellProps = {
  title: string;
  eyebrow: string;
  icon: LucideIcon;
  accent?: string;
  status?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  panelTestId: string;
  closeTestId: string;
  titleTestId?: string;
};

export function DrawerShell({
  title,
  eyebrow,
  icon: Icon,
  accent,
  status,
  children,
  footer,
  onClose,
  panelTestId,
  closeTestId,
  titleTestId,
}: DrawerShellProps) {
  const titleId = useId();
  const { ref, handleKeyDown } = useFocusTrap<HTMLElement>(onClose);
  const style = accent
    ? ({ "--drawer-accent": accent } as CSSProperties)
    : undefined;

  return (
    <div
      className="drawer-overlay"
      onClick={(event) => {
        if (
          event.target === event.currentTarget ||
          (event.target as HTMLElement).classList.contains("drawer-backdrop")
        ) {
          onClose();
        }
      }}
    >
      <div className="drawer-backdrop" aria-hidden="true" />
      <aside
        ref={ref}
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        style={style}
        data-testid={panelTestId}
      >
        <header className="drawer-header">
          <div className="drawer-header__identity">
            <span className="drawer-header__icon" aria-hidden="true">
              <Icon size={20} strokeWidth={2} />
            </span>
            <div className="drawer-header__copy">
              <div className="drawer-header__eyebrow">{eyebrow}</div>
              <h2
                className="drawer-header__title"
                id={titleId}
                data-testid={titleTestId}
              >
                {title}
              </h2>
              {status && <div className="drawer-header__status">{status}</div>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="drawer-close"
            aria-label="Cerrar panel"
            data-testid={closeTestId}
          >
            <ACTION_ICONS.close size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <footer className="drawer-footer">{footer}</footer>}
      </aside>
    </div>
  );
}

export function DrawerState({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  const Icon = error ? STATUS_ICONS.danger : ACTION_ICONS.loader;
  return (
    <div
      className={`drawer-state${error ? " drawer-state--error" : ""}`}
      role={error ? "alert" : "status"}
      aria-live={error ? "assertive" : "polite"}
    >
      <span className="drawer-state__icon" aria-hidden="true">
        <Icon size={20} className={error ? undefined : "animate-spin"} />
      </span>
      <span>{message}</span>
    </div>
  );
}

export function Section({
  title,
  children,
  testId,
  quiet = false,
}: {
  title: string;
  children: ReactNode;
  testId?: string;
  quiet?: boolean;
}) {
  return (
    <section
      className={`drawer-section${quiet ? " drawer-section--quiet" : ""}`}
      data-testid={testId}
    >
      <h3 className="section-title">{title}</h3>
      <div className="section-body">{children}</div>
    </section>
  );
}

export function Row({
  icon: Icon,
  label,
  value,
  testId,
}: {
  icon: LucideIcon | null;
  label: string;
  value: ReactNode;
  testId?: string;
}) {
  return (
    <div className="detail-row" data-testid={testId}>
      <span className="detail-row__icon" aria-hidden="true">
        {Icon && <Icon size={15} />}
      </span>
      <span className="detail-row__label">{label}</span>
      <span className="detail-row__value">{value}</span>
    </div>
  );
}

export function LinkedCard({
  children,
  onClick,
  accent,
  testId,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  accent?: string;
  testId?: string;
  className?: string;
}) {
  const classes = `linked-card${onClick ? " linked-card--interactive" : ""}${className ? ` ${className}` : ""}`;
  const style = accent
    ? ({ "--linked-card-accent": accent } as CSSProperties)
    : undefined;

  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        onClick={onClick}
        style={style}
        data-testid={testId}
      >
        <span className="linked-card__content">{children}</span>
        <PAGINATION_ICONS.next
          className="linked-card__chevron"
          size={17}
          aria-hidden="true"
        />
      </button>
    );
  }

  return (
    <div className={classes} style={style} data-testid={testId}>
      <span className="linked-card__content">{children}</span>
    </div>
  );
}
