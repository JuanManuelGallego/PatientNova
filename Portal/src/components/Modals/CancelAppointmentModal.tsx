import { ConfirmDialog } from "@/src/components/Modals/ConfirmDialog";
import { STATUS_ICONS } from "@/src/config/icons";
import { useUpdateAppointment } from "@/src/api/appointments/useUpdateAppointment";
import { useUpdateReminder } from "@/src/api/reminders/useUpdateReminder";
import { Appointment, AppointmentStatus } from "@/src/types/Appointment";
import { ReminderStatus } from "@/src/types/Reminder";
import { fmtDate } from "@/src/utils/timeUtils";
import { useState } from "react";

export function CancelAppointmentModal({
  appt,
  onClose,
  onCanceled,
}: {
  appt: Appointment;
  onClose: () => void;
  onCanceled: () => void;
}) {
  const { updateAppointment, loading: cancelingAppt } = useUpdateAppointment();
  const { updateReminder, loading: cancelingReminder } = useUpdateReminder();
  const [error, setError] = useState<string | null>(null);
  const loading = cancelingAppt || cancelingReminder;

  async function handleCancel() {
    setError(null);
    try {
      await updateAppointment(appt.id, { status: AppointmentStatus.CANCELLED });
      if (appt.reminder && appt.reminder.id)
        await updateReminder(appt.reminder.id, {
          status: ReminderStatus.CANCELLED,
        });
      onCanceled();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <ConfirmDialog
      icon={STATUS_ICONS.ban}
      title="Cancelar Cita"
      confirmLabel="Sí, cancelar"
      loadingLabel="Cancelando…"
      loading={loading}
      error={error}
      nested
      onClose={onClose}
      onConfirm={handleCancel}
    >
      <p className="modal-confirm__text">
        ¿Estás seguro que deseas cancelar la cita de <br />
        <strong>
          {appt.patient.name} {appt.patient.lastName}
        </strong>{" "}
        del <strong>{fmtDate(appt.startAt)}</strong>?
      </p>
    </ConfirmDialog>
  );
}
