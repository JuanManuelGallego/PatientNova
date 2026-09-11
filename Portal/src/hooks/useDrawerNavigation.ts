import { useState } from "react";
import { Appointment } from "@/src/types/Appointment";
import { Patient } from "@/src/types/Patient";
import { Reminder } from "@/src/types/Reminder";

export enum DrawerType {
  APPOINTMENT = "APPOINTMENT",
  PATIENT = "PATIENT",
  REMINDER = "REMINDER",
}

export type DrawerTarget =
  | { type: DrawerType.APPOINTMENT; value: Appointment }
  | { type: DrawerType.PATIENT; value: Patient }
  | { type: DrawerType.REMINDER; value: Reminder };

export function useDrawerNavigation() {
  const [target, setTarget] = useState<DrawerTarget | null>(null);

  return {
    target,
    close: () => setTarget(null),
    openAppointment: (appointment: Appointment) =>
      setTarget({ type: DrawerType.APPOINTMENT, value: appointment }),
    openPatient: (patient: Patient) =>
      setTarget({ type: DrawerType.PATIENT, value: patient }),
    openReminder: (reminder: Reminder) =>
      setTarget({ type: DrawerType.REMINDER, value: reminder }),
  };
}
