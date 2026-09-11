import { Appointment } from "@/src/types/Appointment";
import { Patient } from "@/src/types/Patient";
import { Reminder } from "@/src/types/Reminder";
import {
  DrawerTarget,
  DrawerType,
} from "@/src/hooks/useDrawerNavigation";
import { AppointmentDrawer } from "./AppointmentDrawer";
import { PatientDrawer } from "./PatientDrawer";
import { ReminderDrawer } from "./ReminderDrawer";

type AppointmentActions = {
  onEdit?: (appointment: Appointment) => void;
  onPay?: (appointment: Appointment) => void;
  onDelete?: (appointment: Appointment) => void;
};

type PatientActions = {
  onEdit?: (patient: Patient) => void;
  onDelete?: (patient: Patient) => void;
};

type ReminderActions = {
  onEdit?: (reminder: Reminder) => void;
  onCancel?: (reminder: Reminder) => void;
  onRetry?: (reminder: Reminder) => void | Promise<void>;
  retryLoading?: boolean;
};

export function RelatedDrawers({
  target,
  onClose,
  onViewAppointment,
  onViewPatient,
  onViewReminder,
  appointmentActions,
  patientActions,
  reminderActions,
}: {
  target: DrawerTarget | null;
  onClose: () => void;
  onViewAppointment: (appointment: Appointment) => void;
  onViewPatient: (patient: Patient) => void;
  onViewReminder: (reminder: Reminder) => void;
  appointmentActions?: AppointmentActions;
  patientActions?: PatientActions;
  reminderActions?: ReminderActions;
}) {
  if (!target) return null;

  switch (target.type) {
    case DrawerType.APPOINTMENT:
      return (
        <AppointmentDrawer
          appt={target.value}
          onClose={onClose}
          onEdit={
            appointmentActions?.onEdit
              ? () => appointmentActions.onEdit?.(target.value)
              : undefined
          }
          onPay={
            appointmentActions?.onPay
              ? () => appointmentActions.onPay?.(target.value)
              : undefined
          }
          onDelete={
            appointmentActions?.onDelete
              ? () => appointmentActions.onDelete?.(target.value)
              : undefined
          }
          onViewPatient={onViewPatient}
          onViewReminder={onViewReminder}
        />
      );
    case DrawerType.PATIENT:
      return (
        <PatientDrawer
          patient={target.value}
          onClose={onClose}
          onEdit={
            patientActions?.onEdit
              ? () => patientActions.onEdit?.(target.value)
              : undefined
          }
          onDelete={
            patientActions?.onDelete
              ? () => patientActions.onDelete?.(target.value)
              : undefined
          }
          onViewAppointment={onViewAppointment}
          onViewReminder={onViewReminder}
        />
      );
    case DrawerType.REMINDER:
      return (
        <ReminderDrawer
          reminder={target.value}
          onClose={onClose}
          onEdit={
            reminderActions?.onEdit
              ? () => reminderActions.onEdit?.(target.value)
              : undefined
          }
          onCancel={
            reminderActions?.onCancel
              ? () => reminderActions.onCancel?.(target.value)
              : undefined
          }
          onRetry={
            reminderActions?.onRetry
              ? () => reminderActions.onRetry?.(target.value)
              : undefined
          }
          retryLoading={reminderActions?.retryLoading}
          onViewPatient={onViewPatient}
          onViewAppointment={onViewAppointment}
        />
      );
  }
}
