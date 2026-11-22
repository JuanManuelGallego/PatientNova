"use client";

import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import { createPortal } from "react-dom";
import { usePhoneLayout } from "@/src/hooks/usePhoneLayout";
import styles from "./Fab.module.css";

export const FAB_REPLACED_CLASS = styles.replaced;

interface FabProps {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  testId?: string;
}

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
