import { useState } from "react";
import { useDeleteAppointmentType } from "@/src/api/appointment-types/useDeleteAppointmentType";
import { AppointmentType } from "@/src/types/Appointment";
import { ConfirmDialog } from "./ConfirmDialog";
import { STATUS_ICONS } from "@/src/config/icons";

export function DeleteAppointmentTypeModal({
  appointmentType,
  onClose,
  onDelete,
}: {
  appointmentType: AppointmentType;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { deleteAppointmentType, loading } = useDeleteAppointmentType();
  const [ error, setError ] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    try {
      await deleteAppointmentType(appointmentType.id);
      onDelete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  return (
    <ConfirmDialog
      icon={STATUS_ICONS.calendar}
      title="Eliminar tipo de cita"
      confirmLabel="Sí, eliminar"
      loadingLabel="Desactivando…"
      loading={loading}
      error={error}
      testId="delete-appointment-type-dialog"
      onClose={onClose}
      onConfirm={handleConfirm}
    >
      <p className="modal-confirm__text">
        ¿Deseas eliminar <strong>{appointmentType.name}</strong>?<br />
      </p>
    </ConfirmDialog>
  );
}
