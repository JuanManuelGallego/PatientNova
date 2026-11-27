import { Appointment, AppointmentType } from "@/src/types/Appointment";
import { User } from "@/src/types/User";
import { Channel, ReminderMode } from "@/src/types/Reminder";
import { fmtDate, fmtTime } from "@/src/utils/TimeUtils";
import {
  TwilioTemplate,
  TemplateVariableAutoFill,
  TEMPLATE_KEYS,
} from "@/src/utils/twilioConfig";

export function computeAutoFilledVariables(
  template: TwilioTemplate,
  patientName: string,
  doctorName: string,
  appointment?: Appointment | null,
  user?: User | null,
  appointmentType?: AppointmentType | null,
  consentVersionId?: string | null,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const v of template.variables) {
    vars[v.key] = resolveAutoFill(v.autoFill, patientName, doctorName, appointment, user, appointmentType, consentVersionId);
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
  consentVersionId?: string | null,
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
      return user ? [ user.firstName, user.lastName ].filter(Boolean).join(" ") || user.displayName : "";
    case "nationalId":
      return user?.nationalId ?? "";
    case "bankingKey":
      return user?.bankingKey ?? "";
    case "price": {
      const price = appointment?.price ?? appointmentType?.defaultPrice;
      return price != null ? String(price) : "";
    }
    case "consentDocumentId":
      return consentVersionId ?? "";
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

/** The welcome is sent by the server (POST /patients/:id/welcome), which audits the consent version. */
export const WELCOME_TEMPLATE_KEY = "PATIENT_WELCOME_MESSAGE";

/** Template keys offered for a send mode: the welcome goes out only now, never scheduled. */
export function templateKeysFor(sendMode: ReminderMode): string[] {
  return TEMPLATE_KEYS.filter((key) => sendMode === ReminderMode.IMMEDIATE || key !== WELCOME_TEMPLATE_KEY);
}

export function linksConsentDocument(template: TwilioTemplate): boolean {
  return template.variables.some((v) => v.autoFill === "consentDocumentId");
}

export function buildMessageBody(
  template: TwilioTemplate,
  contentVariables: Record<string, string>,
  channel: Channel,
  consentUrl?: string | null,
): string {
  if (channel !== Channel.WHATSAPP && template.textTemplate) {
    return buildPreview({ ...template, template: template.textTemplate }, contentVariables)
      .replaceAll("{{9}}", consentUrl || "{{9}}");
  }
  const text = buildPreview(template, contentVariables);
  if (channel === Channel.WHATSAPP || !consentUrl || !linksConsentDocument(template)) return text;
  return `${text}\n\nDocumento de consentimiento: ${consentUrl}`;
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