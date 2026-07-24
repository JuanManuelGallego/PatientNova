import { ConfirmDialog } from "@/src/components/Modals/ConfirmDialog";
import { STATUS_ICONS } from "@/src/config/icons";
import { Patient } from "@/src/types/Patient";
import { useState } from "react";
import { useDeletePatient } from "@/src/api/patients/useDeletePatient";

export function DeletePatientModal({
  patient,
  onClose,
  onDeleted,
}: {
  patient: Patient;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { deletePatient, loading } = useDeletePatient();
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    try {
      await deletePatient(patient.id);
      onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  return (
    <ConfirmDialog
      icon={STATUS_ICONS.trash}
      title="Eliminar Paciente"
      confirmLabel="Sí, eliminar"
      loadingLabel="Eliminando…"
      cancelLabel="Cancelar"
      loading={loading}
      error={error}
      onClose={onClose}
      onConfirm={handleDelete}
    >
      <p className="modal-confirm__text">
        ¿Estás seguro que deseas eliminar a{" "}
        <strong>
          {patient.name} {patient.lastName}
        </strong>
        ?
      </p>
      <p className="modal-confirm__text">Esta acción no se puede deshacer.</p>
    </ConfirmDialog>
  );
}
