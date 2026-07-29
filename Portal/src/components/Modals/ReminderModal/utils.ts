import { Appointment, AppointmentType } from "@/src/types/Appointment";
import { User } from "@/src/types/User";
import { fmtDate, fmtTime } from "@/src/utils/TimeUtils";
import {
  TwilioTemplate,
  TemplateVariableAutoFill,
} from "@/src/utils/twilioConfig";

export function computeAutoFilledVariables(
  template: TwilioTemplate,
  patientName: string,
  doctorName: string,
  appointment?: Appointment | null,
  user?: User | null,
  appointmentType?: AppointmentType | null,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const v of template.variables) {
    vars[v.key] = resolveAutoFill(v.autoFill, patientName, doctorName, appointment, user, appointmentType);
  }
  return vars;
}

function resolveAutoFill(
  autoFill: TemplateVariableAutoFill | undefined,
  patientName: string,
  doctorName: string,
  appointment?: Appointment | null,
  user?: User | null,
  appointmentType?: AppointmentType | null,
): string {
  switch (autoFill) {
    case "patientName":
      return patientName;
    case "doctorName":
      return doctorName;
    case "appointmentDate":
      return appointment ? fmtDate(appointment.startAt) : "";
    case "appointmentTime":
      return appointment ? fmtTime(appointment.startAt) : "";
    case "meetingUrl":
      return appointment?.meetingUrl ?? "";
    case "locationAddress":
      return appointment?.appointmentLocation?.address ?? "";
    case "locationInstructions":
      return appointment?.appointmentLocation?.instructions ?? "";
    case "bankName":
      return user?.bankName ?? "";
    case "accountNumber":
      return user?.accountNumber ?? "";
    case "accountHolder":
      return user ? `${user.firstName} ${user.lastName}` : "";
    case "nationalId":
      return user?.nationalId ?? "";
    case "bankingKey":
      return user?.bankingKey ?? "";
    case "price": {
      const price = appointment?.price ?? appointmentType?.defaultPrice;
      return price != null ? String(price) : "";
    }
    case "userId":
      return user?.id ?? "";
    default:
      return "";
  }
}

export function buildPreview(
  template: TwilioTemplate,
  contentVariables: Record<string, string>,
): string {
  let text = template.template;
  for (const v of template.variables) {
    text = text.replaceAll(`{{${v.key}}}`, contentVariables[v.key] || `{{${v.key}}}`);
  }
  return text;
}

export function selectTemplateForAppointment(appointment: Appointment): string {
  if (appointment.appointmentLocation?.isVirtual) {
    return "PATIENT_APPOINTMENT_REMINDER_CONFIRMATION_VIRTUAL";
  }
  return "PATIENT_APPOINTMENT_REMINDER_CONFIRMATION_PRESENTIAL";
}

export function buildAutoFilledFormVariables(
  template: TwilioTemplate,
  patientName: string,
  doctorName: string,
  appointment?: Appointment | null,
  user?: User | null,
  appointmentType?: AppointmentType | null,
): Record<string, string> {
  return computeAutoFilledVariables(template, patientName, doctorName, appointment, user, appointmentType);
}

export function mergeContentVariables(
  current: Record<string, string>,
  autoFilled: Record<string, string>,
): Record<string, string> {
  return { ...current, ...autoFilled };
}