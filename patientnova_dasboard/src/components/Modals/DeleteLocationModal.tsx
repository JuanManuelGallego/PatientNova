import { useState } from "react";
import { useDeleteLocation } from "@/src/api/useDeleteLocation";
import { AppointmentLocation } from "@/src/types/Appointment";
import { ConfirmDialog } from "./ConfirmDialog";

export function DeleteLocationModal({
    location,
    onClose,
    onDeactivated,
}: {
    location: AppointmentLocation;
    onClose: () => void;
    onDeactivated: () => void;
}) {
    const { deleteLocation, loading } = useDeleteLocation();
    const [ error, setError ] = useState<string | null>(null);

    async function handleConfirm() {
        setError(null);
        try {
            await deleteLocation(location.id);
            onDeactivated();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al desactivar");
        }
    }

    return (
        <ConfirmDialog
            icon="📍"
            title="Desactivar ubicación"
            confirmLabel="Sí, desactivar"
            loadingLabel="Desactivando…"
            loading={loading}
            error={error}
            onClose={onClose}
            onConfirm={handleConfirm}
        >
            <p className="modal-confirm__text">
                ¿Deseas desactivar <strong>{location.name}</strong>?<br />
                Podrás reactivarla en cualquier momento.
            </p>
        </ConfirmDialog>
    );
}
