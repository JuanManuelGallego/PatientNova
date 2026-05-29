import { ConfirmDialog } from "@/src/components/Modals/ConfirmDialog";
import { STATUS_ICONS } from "@/src/config/icons";
import { useUpdatePatient } from "@/src/api/useUpdatePatient";
import { Patient, PatientStatus } from "@/src/types/Patient";
import { useState } from "react";

export function ArchivePatientModal({
  patient,
  onClose,
  onDeleted,
}: {
  patient: Patient;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { updatePatient, loading } = useUpdatePatient();
  const [error, setError] = useState<string | null>(null);

  async function handleArchive() {
    setError(null);
    try {
      await updatePatient(patient.id, { status: PatientStatus.ARCHIVED });
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
      onConfirm={handleArchive}
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
