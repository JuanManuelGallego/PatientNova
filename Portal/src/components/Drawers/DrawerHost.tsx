"use client";

import { useState } from "react";
import { useUpdateAppointment } from "@/src/api/appointments/useUpdateAppointment";
import { useRetryReminder } from "@/src/api/reminders/useRetryReminder";
import { ErrorBanner } from "@/src/components/Info/ErrorBanner";
import { AppointmentModal } from "@/src/components/Modals/AppointmentModal";
import { CancelAppointmentModal } from "@/src/components/Modals/CancelAppointmentModal";
import { CancelReminderModal } from "@/src/components/Modals/CancelReminderModal";
import { EditScheduledReminderModal } from "@/src/components/Modals/EditScheduledReminderModal";
import { PatientModal } from "@/src/components/Modals/PatientModal";
import { TogglePatientModal } from "@/src/components/Modals/TogglePatientModal";
import { DrawerTarget } from "@/src/hooks/useDrawerNavigation";
import { Appointment, AppointmentStatus } from "@/src/types/Appointment";
import { Patient } from "@/src/types/Patient";
import { Reminder } from "@/src/types/Reminder";
import { RelatedDrawers } from "./RelatedDrawers";

/**
 * The drawers with every action wired, whichever page opened them. Pages pass
 * only navigation and `onChanged` (refetch their own list and stats): the
 * handlers and modals live here so a drawer reached from a related entity
 * (a patient from an appointment) has the same buttons as one opened from its
 * own table.
 */
export function DrawerHost({
  target,
  onClose,
  onViewAppointment,
  onViewPatient,
  onViewReminder,
  onChanged,
}: {
  target: DrawerTarget | null;
  onClose: () => void;
  onViewAppointment: (appointment: Appointment) => void;
  onViewPatient: (patient: Patient) => void;
  onViewReminder: (reminder: Reminder) => void;
  onChanged?: () => void;
}) {
  const { updateAppointment } = useUpdateAppointment();
  const { retryReminder, loading: retryLoading } = useRetryReminder();
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [deleteAppt, setDeleteAppt] = useState<Appointment | null>(null);
  const [editPatient, setEditPatient] = useState<Patient | null>(null);
  const [togglePatient, setTogglePatient] = useState<Patient | null>(null);
  const [editReminder, setEditReminder] = useState<Reminder | null>(null);
  const [cancelReminder, setCancelReminder] = useState<Reminder | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const changed = () => onChanged?.();

  async function updateAppt(
    id: string,
    data: { paid: true } | { status: AppointmentStatus.CONFIRMED },
    fallback: string,
  ) {
    setActionError(null);
    try {
      await updateAppointment(id, data);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : fallback);
    } finally {
      changed();
    }
  }

  // Each action opens its modal and closes the drawer, as the pages did.
  const open = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    onClose();
  };

  return (
    <>
      {actionError && <ErrorBanner msg={actionError} onRetry={() => setActionError(null)} />}
      <RelatedDrawers
        target={target}
        onClose={onClose}
        onViewAppointment={onViewAppointment}
        onViewPatient={onViewPatient}
        onViewReminder={onViewReminder}
        appointmentActions={{
          onEdit: open(setEditAppt),
          onDelete: open(setDeleteAppt),
          onConfirm: (appointment) => {
            void updateAppt(appointment.id, { status: AppointmentStatus.CONFIRMED }, "Error al confirmar la cita");
            onClose();
          },
          onPay: (appointment) => {
            void updateAppt(appointment.id, { paid: true }, "Error al registrar el pago");
            onClose();
          },
        }}
        patientActions={{
          onEdit: open(setEditPatient),
          onDelete: open(setTogglePatient),
        }}
        reminderActions={{
          onEdit: open(setEditReminder),
          onCancel: open(setCancelReminder),
          onRetry: async (reminder) => {
            await retryReminder(reminder.id);
            onClose();
            changed();
          },
          retryLoading,
        }}
      />
      {editAppt && (
        <AppointmentModal appt={editAppt} onClose={() => setEditAppt(null)} onSaved={changed} />
      )}
      {deleteAppt && (
        <CancelAppointmentModal appt={deleteAppt} onClose={() => setDeleteAppt(null)} onCanceled={changed} />
      )}
      {editPatient && (
        <PatientModal patient={editPatient} onClose={() => setEditPatient(null)} onSaved={changed} />
      )}
      {togglePatient && (
        <TogglePatientModal patient={togglePatient} onClose={() => setTogglePatient(null)} onDone={changed} />
      )}
      {editReminder && (
        <EditScheduledReminderModal reminder={editReminder} onClose={() => setEditReminder(null)} onSaved={changed} />
      )}
      {cancelReminder && (
        <CancelReminderModal
          reminder={cancelReminder}
          onClose={() => setCancelReminder(null)}
          onCanceled={() => {
            setCancelReminder(null);
            changed();
          }}
        />
      )}
    </>
  );
}
