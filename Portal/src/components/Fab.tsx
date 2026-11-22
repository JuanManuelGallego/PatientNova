"use client";

import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import { createPortal } from "react-dom";
import { usePhoneLayout } from "@/src/hooks/usePhoneLayout";
import styles from "./Fab.module.css";

/**
 * Add to the control a `Fab` replaces, so phones show only the floating button (hidden by CSS below 640px,
 * the same threshold as `usePhoneLayout`, so the two never disagree).
 */
export const FAB_REPLACED_CLASS = styles.replaced;

interface FabProps {
  /** The accessible name, and what the button does ("Nueva cita"). */
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  testId?: string;
}

/**
 * The page's main action as a floating button, on phones only (bottom-right, above the bottom tab bar and the
 * safe area). Render it at the end of the page content: it leaves a spacer there so the last item is never
 * covered, and portals the button to `<body>` so no ancestor can clip or re-anchor it.
 */
export function Fab({ label, onClick, icon: Icon = Plus, testId }: FabProps) {
  const phone = usePhoneLayout();
  if (!phone) return null;
  return (
    <>
      <div className={styles.spacer} data-fab-spacer aria-hidden="true" />
      {createPortal(
        <button type="button" className={styles.fab} aria-label={label} onClick={onClick} data-testid={testId}>
          <Icon size={26} strokeWidth={2.25} aria-hidden="true" />
        </button>,
        document.body,
      )}
    </>
  );
}
