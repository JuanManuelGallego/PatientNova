export type TemplateVariableAutoFill =
  | "patientName"
  | "doctorName"
  | "bankName"
  | "accountNumber"
  | "accountHolder"
  | "nationalId"
  | "bankingKey"
  | "appointmentDate"
  | "appointmentTime"
  | "meetingUrl"
  | "locationAddress"
  | "locationInstructions"
  | "price"
  | "userId";

export type TemplateVariable = {
  key: string;
  label: string;
  autoFill?: TemplateVariableAutoFill;
};

export type TwilioTemplate = {
  label: string;
  contentSid: string;
  template: string;
  variables: TemplateVariable[];
  canBulkSend: boolean;
};

export const TWILIO_CONFIG: Record<string, TwilioTemplate> = {
    PATIENT_APPOINTMENT_REMINDER_CONFIRMATION_PRESENTIAL: {
        label: "Recordatorio cita presencial",
        contentSid: "HX22846eed9e38b750cdc0472e60416b10",
        template: "Asunto: Recordatorio de cita\n\nBuen día {{1}}, espero que se encuentre muy bien.\n\nLe escribimos para recordarle su próxima cita presencial con {{2}}:\n\nFecha: {{3}}\n\nHora: {{4}}\n\nDirección: {{5}}\n\nInstrucciones: {{6}}\n\nLe recordamos cordialmente que el pago de la consulta debe estar gestionado y confirmado antes del inicio de la sesión.\n\nQuedamos a su disposición para cualquier duda. ¡Feliz día!",
        variables: [
            { key: "1", label: "Nombre del paciente", autoFill: "patientName" },
            { key: "2", label: "Doctor", autoFill: "doctorName" },
            { key: "3", label: "Fecha", autoFill: "appointmentDate" },
            { key: "4", label: "Hora", autoFill: "appointmentTime" },
            { key: "5", label: "Dirección", autoFill: "locationAddress" },
            { key: "6", label: "Instrucciones", autoFill: "locationInstructions" },
        ],
        canBulkSend: false,
    },
    PATIENT_APPOINTMENT_REMINDER_CONFIRMATION_VIRTUAL: {
        label: "Recordatorio cita virtual",
        contentSid: "HX4a988ec65d4afaec679c99b3ac218517",
        template: "Asunto: Recordatorio de cita\n\nBuen día {{1}}, espero que se encuentre muy bien.\n\nLe escribimos para recordarle su próxima cita virtual con {{2}}:\n\nFecha: {{3}}\n\nHora: {{4}}\n\nEnlace de la reunión: {{5}}\n\nLe recordamos cordialmente que el pago de la consulta debe estar gestionado y confirmado antes del inicio de la sesión.\n\nQuedamos a su disposición para cualquier duda. ¡Feliz día!",
        variables: [
            { key: "1", label: "Nombre del paciente", autoFill: "patientName" },
            { key: "2", label: "Doctor", autoFill: "doctorName" },
            { key: "3", label: "Fecha", autoFill: "appointmentDate" },
            { key: "4", label: "Hora", autoFill: "appointmentTime" },
            { key: "5", label: "Enlace de reunión", autoFill: "meetingUrl" },
        ],
        canBulkSend: false,
    },
    PATIENT_WELCOME_MESSAGE: {
        label: "Mensaje de bienvenida",
        contentSid: "HX5e1bff9b1e1afccb0602456fca397773",
        template: "¡Hola {{1}}! Te damos la bienvenida a Patient Nova, la plataforma de recordatorios de citas de {{2}}. A través de este canal, podrás confirmar o cancelar tus próximas citas de forma rápida. Te recordamos que el pago de la consulta se realiza antes de asistir a tu cita. Banco: {{3}} Número de cuenta: {{4}} A nombre de: {{5}} Cédula: {{6}} Llave: {{7}} Por favor, descarga y completa este documento de consentimiento adjunto en este mensaje antes de tu primera consulta. ¡Muchas gracias!",
        variables: [
            { key: "1", label: "Nombre del paciente", autoFill: "patientName" },
            { key: "2", label: "Doctor", autoFill: "doctorName" },
            { key: "3", label: "Banco", autoFill: "bankName" },
            { key: "4", label: "Número de cuenta", autoFill: "accountNumber" },
            { key: "5", label: "A nombre de", autoFill: "accountHolder" },
            { key: "6", label: "Cédula", autoFill: "nationalId" },
            { key: "7", label: "Llave", autoFill: "bankingKey" },
            { key: "8", label: "UserId", autoFill: "userId" },
        ],
        canBulkSend: false,
    },
    PATIENT_CONSENT_DOCUMENT:{
        label: "Documento de consentimiento",
        contentSid: "HX6950531b8abc3a822cedd8d9578e5383",
        template: "¡Hola {{1}}! Por favor, descarga y completa este documento de consentimiento adjunto en este mensaje antes de tu proxima consulta con {{2}}. ¡Muchas gracias!",
        variables: [
            { key: "1", label: "Nombre del paciente", autoFill: "patientName" },
            { key: "2", label: "Doctor", autoFill: "doctorName" },
            { key: "3", label: "UserId", autoFill: "userId" },
        ],
        canBulkSend: false,
    },
    PATIENT_PAYMENT_REMINDER:{
        label: "Recordatorio de pago",
        contentSid: "HX27fd3f66ca6dfef0e59c19f16d381032",
        template: "¡Hola {{1}}! Te recordamos que tienes un pago pendiente de ${{2}}. Puedes cancelar con los datos siguientes: Banco: {{3}} Número de cuenta:  {{4}} A nombre de: {{5}} Cédula: {{6}} Llave: {{7}} ¡Muchas gracias!",
        variables: [
            { key: "1", label: "Nombre del paciente", autoFill: "patientName" },
            { key: "2", label: "Precio", autoFill: "price" },
            { key: "3", label: "Banco", autoFill: "bankName" },
            { key: "4", label: "Número de cuenta", autoFill: "accountNumber" },
            { key: "5", label: "A nombre de", autoFill: "accountHolder" },
            { key: "6", label: "Cédula", autoFill: "nationalId" },
            { key: "7", label: "Llave", autoFill: "bankingKey" },
        ],
        canBulkSend: false,
    },
};

export const TEMPLATE_KEYS = Object.keys(TWILIO_CONFIG) as (keyof typeof TWILIO_CONFIG)[];

export const BULK_TEMPLATE_KEYS = TEMPLATE_KEYS.filter(
  (key) => TWILIO_CONFIG[key].canBulkSend,
) as (keyof typeof TWILIO_CONFIG)[];
