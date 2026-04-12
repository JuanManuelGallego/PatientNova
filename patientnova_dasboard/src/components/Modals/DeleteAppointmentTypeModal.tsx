import { useState } from "react";
import { useDeleteAppointmentType } from "@/src/api/useDeleteAppointmentType";
import { AppointmentType } from "@/src/types/Appointment";
import { ConfirmDialog } from "./ConfirmDialog";

export function DeleteAppointmentTypeModal({
    appointmentType,
    onClose,
    onDeactivated,
}: {
    appointmentType: AppointmentType;
    onClose: () => void;
    onDeactivated: () => void;
}) {
    const { deleteAppointmentType, loading } = useDeleteAppointmentType();
    const [ error, setError ] = useState<string | null>(null);

    async function handleConfirm() {
        setError(null);
        try {
            await deleteAppointmentType(appointmentType.id);
            onDeactivated();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al desactivar");
        }
    }

    return (
        <ConfirmDialog
            icon="📅"
            title="Desactivar tipo de cita"
            confirmLabel="Sí, desactivar"
            loadingLabel="Desactivando…"
            loading={loading}
            error={error}
            onClose={onClose}
            onConfirm={handleConfirm}
        >
            <p className="modal-confirm__text">
                ¿Deseas desactivar <strong>{appointmentType.name}</strong>?<br />
                Podrás reactivarlo en cualquier momento.
            </p>
        </ConfirmDialog>
    );
}
