import { Patient } from "./Patient";
import { Channel, ReminderStatus } from "./Reminder";

export interface Appointment {
    id: string;
    patient: Patient;
    date: string;
    time: string;
    type: string;
    reminderChannels: Channel[];
    reminderStatus: ReminderStatus;
    reminderScheduledFor: string;
}


export const APPOINTMENT_TYPES = [
    "Revisión General", "Revisión de Análisis de Sangre", "Consulta de Seguimiento",
    "Vacunación", "Cribado Cardiológico", "Primera Consulta", "Control de Medicamentos",
    "Fisioterapia", "Radiografía", "Consulta de Nutrición",
];
