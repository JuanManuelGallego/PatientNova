import { ConfirmDialog } from "@/src/components/Modals/ConfirmDialog";
import { ACTION_ICONS } from "@/src/config/icons";
import { Patient, PatientStatus } from "@/src/types/Patient";
import { useState } from "react";
import { useUpdatePatient } from "@/src/api/patients/useUpdatePatient";

export function TogglePatientModal({
  patient,
  onClose,
  onDone,
}: {
  patient: Patient;
  onClose: () => void;
  onDone: () => void;
}) {
  const { updatePatient, loading } = useUpdatePatient();
  const [error, setError] = useState<string | null>(null);

  const isActive = patient.status === PatientStatus.ACTIVE;

  async function handleToggle() {
    setError(null);
    try {
      await updatePatient(patient.id, {
        status: isActive ? PatientStatus.INACTIVE : PatientStatus.ACTIVE,
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  return (
    <ConfirmDialog
      icon={isActive ? ACTION_ICONS.cancel : ACTION_ICONS.retry}
      title={isActive ? "Desactivar Paciente" : "Reactivar Paciente"}
      confirmLabel={isActive ? "Sí, desactivar" : "Sí, reactivar"}
      confirmVariant={isActive ? "danger" : "success"}
      loadingLabel={isActive ? "Desactivando…" : "Reactivando…"}
      cancelLabel="Cancelar"
      loading={loading}
      error={error}
      testId="delete-patient"
      onClose={onClose}
      onConfirm={handleToggle}
    >
      <p className="modal-confirm__text">
        ¿Estás seguro que deseas {isActive ? "desactivar" : "reactivar"} a{" "}
        <strong>
          {patient.name} {patient.lastName}
        </strong>
        ?
      </p>
      <p className="modal-confirm__text">
        {isActive
          ? "El paciente dejará de recibir notificaciones y pasará a la lista de inactivos."
          : "El paciente volverá a recibir notificaciones y pasará a la lista de activos."}
      </p>
    </ConfirmDialog>
  );
}
