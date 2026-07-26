import { useState } from "react";
import { ConfirmDialog } from "@/src/components/Modals/ConfirmDialog";
import { STATUS_ICONS } from "@/src/config/icons";
import { useDeleteBlockedTime } from "@/src/api/blocked-time/useDeleteBlockedTime";
import { BlockedTime } from "@/src/types/BlockedTime";
import { fmtDate } from "@/src/utils/TimeUtils";

export function DeleteBlockedTimeModal({
  blockedTime,
  onClose,
  onDeleted,
}: {
  blockedTime: BlockedTime;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { deleteBlockedTime, loading } = useDeleteBlockedTime();
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    try {
      await deleteBlockedTime(blockedTime.id);
      onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <ConfirmDialog
      icon={STATUS_ICONS.warning}
      title="Eliminar Horario Bloqueado"
      confirmLabel="Sí, eliminar"
      loadingLabel="Eliminando…"
      loading={loading}
      error={error}
      nested
      onClose={onClose}
      onConfirm={handleDelete}
    >
      <p className="modal-confirm__text">
        ¿Estás seguro que deseas eliminar el horario bloqueado del{" "}
        <strong>{fmtDate(blockedTime.startTimeUtc)}</strong>
        {blockedTime.description && (
          <> ({blockedTime.description})</>
        )}?
      </p>
    </ConfirmDialog>
  );
}
