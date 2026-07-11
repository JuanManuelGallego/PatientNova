import { ConfirmDialog } from "@/src/components/Modals/ConfirmDialog";
import { STATUS_ICONS } from "@/src/config/icons";
import { useUpdateReminder } from "@/src/api/useUpdateReminder";
import { Reminder, ReminderStatus } from "@/src/types/Reminder";
import { useState } from "react";

export function CancelReminderModal({
  reminder,
  onClose,
  onCanceled,
}: {
  reminder: Reminder;
  onClose: () => void;
  onCanceled: () => void;
}) {
  const { updateReminder, loading } = useUpdateReminder();
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setError(null);
    try {
      await updateReminder(reminder.id, { status: ReminderStatus.CANCELLED });
      onCanceled();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  return (
    <ConfirmDialog
      icon={STATUS_ICONS.ban}
      title="Cancelar Recordatorio"
      confirmLabel="Sí, cancelar"
      loadingLabel="Cancelando…"
      loading={loading}
      error={error}
      onClose={onClose}
      onConfirm={handleCancel}
    >
      <p className="modal-confirm__text">
        ¿Estás seguro que deseas cancelar el recordatorio para{" "}
        <strong>
          {reminder.patient?.name ?? "—"} {reminder.patient?.lastName ?? "—"}
        </strong>
        ?
      </p>
    </ConfirmDialog>
  );
}
