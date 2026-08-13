import { useState } from "react";
import { useDeleteLocation } from "@/src/api/locations/useDeleteLocation";
import { AppointmentLocation } from "@/src/types/Appointment";
import { ConfirmDialog } from "./ConfirmDialog";
import { STATUS_ICONS } from "@/src/config/icons";

export function DeleteLocationModal({
  location,
  onClose,
  onDelete,
}: {
  location: AppointmentLocation;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { deleteLocation, loading } = useDeleteLocation();
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    try {
      await deleteLocation(location.id);
      onDelete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  return (
    <ConfirmDialog
      icon={STATUS_ICONS.mapPin}
      title="Eliminar ubicación"
      confirmLabel="Sí, eliminar"
      loadingLabel="Desactivando…"
      loading={loading}
      error={error}
      testId="delete-location-dialog"
      onClose={onClose}
      onConfirm={handleConfirm}
    >
      <p className="modal-confirm__text">
        ¿Deseas eliminar <strong>{location.name}</strong>?<br />
      </p>
    </ConfirmDialog>
  );
}
