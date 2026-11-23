"use client";

import { useCallback, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/src/components/Modals/ConfirmDialog";
import { STATUS_ICONS } from "@/src/config/icons";
import { saveFile } from "@/src/utils/saveFile";

interface Pending { blob: Blob; filename: string }

/**
 * `saveFile` plus the dialog for when iOS refuses the share because the tap's activation expired
 * (slow PDF render): the second tap, on "Compartir", shares synchronously.
 */
export function useSaveFile(): { save: (blob: Blob, filename: string) => Promise<void>; retryDialog: ReactNode } {
  const [ pending, setPending ] = useState<Pending | null>(null);

  const save = useCallback(async (blob: Blob, filename: string) => {
    if ((await saveFile(blob, filename)) === "needs-tap") setPending({ blob, filename });
  }, []);

  const retryDialog = pending ? (
    <ConfirmDialog
      icon={STATUS_ICONS.success}
      title="Tu archivo está listo"
      confirmLabel="Compartir"
      confirmVariant="success"
      cancelLabel="Cerrar"
      onClose={() => setPending(null)}
      onConfirm={() => {
        const { blob, filename } = pending;
        void saveFile(blob, filename);
        setPending(null);
      }}
    >
      Toca Compartir para guardarlo o enviarlo.
    </ConfirmDialog>
  ) : null;

  return { save, retryDialog };
}
