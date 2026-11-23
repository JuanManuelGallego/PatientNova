"use client";

import { Ref, useImperativeHandle, useState } from "react";
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

export type EntityActions = {
  editAppointment: (appointment: Appointment) => void;
  cancelAppointment: (appointment: Appointment) => void;
  confirmAppointment: (appointment: Appointment) => Promise<void>;
  payAppointment: (appointment: Appointment) => Promise<void>;
  editPatient: (patient: Patient) => void;
  togglePatient: (patient: Patient) => void;
  editReminder: (reminder: Reminder) => void;
  cancelReminder: (reminder: Reminder) => void;
  retryReminder: (reminder: Reminder) => Promise<void>;
};

export function DrawerHost({
  target,
  onClose,
  onViewAppointment,
  onViewPatient,
  onViewReminder,
  onChanged,
  actionsRef,
}: {
  target: DrawerTarget | null;
  onClose: () => void;
  onViewAppointment: (appointment: Appointment) => void;
  onViewPatient: (patient: Patient) => void;
  onViewReminder: (reminder: Reminder) => void;
  onChanged?: () => void;
  actionsRef?: Ref<EntityActions>;
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
  const [inFlight] = useState(() => new Set<string>());

  const changed = () => onChanged?.();

  async function run(key: string, request: () => Promise<unknown>, fallback: string) {
    if (inFlight.has(key)) return;
    inFlight.add(key);
    setActionError(null);
    try {
      await request();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : fallback);
    } finally {
      inFlight.delete(key);
      changed();
    }
  }

  const actions: EntityActions = {
    editAppointment: setEditAppt,
    cancelAppointment: setDeleteAppt,
    confirmAppointment: (a) =>
      run(`confirm:${a.id}`, () => updateAppointment(a.id, { status: AppointmentStatus.CONFIRMED }), "Error al confirmar la cita"),
    payAppointment: (a) =>
      run(`pay:${a.id}`, () => updateAppointment(a.id, { paid: true }), "Error al registrar el pago"),
    editPatient: setEditPatient,
    togglePatient: setTogglePatient,
    editReminder: setEditReminder,
    cancelReminder: setCancelReminder,
    retryReminder: (r) => run(`retry:${r.id}`, () => retryReminder(r.id), "Error al reintentar el recordatorio"),
  };

  useImperativeHandle(actionsRef, () => actions);

  const thenClose = <T,>(action: (value: T) => unknown) => (value: T) => {
    void action(value);
    onClose();
  };

  return (
    <>
      {actionError && (
        <div className="drawer-host-error" role="alert">
          <ErrorBanner msg={actionError} onRetry={() => setActionError(null)} />
        </div>
      )}
      <RelatedDrawers
        target={target}
        onClose={onClose}
        onViewAppointment={onViewAppointment}
        onViewPatient={onViewPatient}
        onViewReminder={onViewReminder}
        appointmentActions={{
          onEdit: thenClose(actions.editAppointment),
          onDelete: thenClose(actions.cancelAppointment),
          onConfirm: thenClose(actions.confirmAppointment),
          onPay: thenClose(actions.payAppointment),
        }}
        patientActions={{
          onEdit: thenClose(actions.editPatient),
          onDelete: thenClose(actions.togglePatient),
        }}
        reminderActions={{
          onEdit: thenClose(actions.editReminder),
          onCancel: thenClose(actions.cancelReminder),
          onRetry: thenClose(actions.retryReminder),
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
