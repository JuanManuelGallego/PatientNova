export const TWILIO_CONFIG = {
    PATIENT_APPOINTMENT_REMINDER: {
        label: "Patient Appointment Reminder",
        contentSid: "HX0a1398b71c666ea718105cc603e69ccd",
        template: "Asunto: Recordatorio de cita\n\nBuen día {{1}}, espero que se encuentre muy bien.\n\nLe escribimos para recordarle su próxima cita con {{2}}:\n\nFecha: {{3}}\n\nHora: {{4}}\n\nLe recordamos cordialmente que el pago de la consulta debe estar gestionado y confirmado antes del inicio de la sesión.\n\nQuedamos a su disposición para cualquier duda. ¡Feliz día!"
    },
    PATIENT_APPOINTMENT_REMINDER_CONFIRMATION: {
        label: "Patient Appointment Reminder With Confirmation",
        contentSid: "HX4676107d3bb61b31582429e9015206e0",
        template: "Asunto: Recordatorio de cita\n\nBuen día {{1}}, espero que se encuentre muy bien.\n\nLe escribimos para recordarle su próxima cita con {{2}}:\n\nFecha: {{3}}\n\nHora: {{4}}\n\nLe recordamos cordialmente que el pago de la consulta debe estar gestionado y confirmado antes del inicio de la sesión.\n\nQuedamos a su disposición para cualquier duda. ¡Feliz día!"
    },
    PATIENT_APPOINTMENT_REMINDER_CONFIRMATION_PRESENTIAL: {
        label: "Patient Appointment Reminder Presential",
        contentSid: "HX22846eed9e38b750cdc0472e60416b10",
        template: "Asunto: Recordatorio de cita\n\nBuen día {{1}}, espero que se encuentre muy bien.\n\nLe escribimos para recordarle su próxima cita presencial con {{2}}:\n\nFecha: {{3}}\n\nHora: {{4}}\n\Dirección: {{5}}\n\Instrucciones: {{6}}\n\nLe recordamos cordialmente que el pago de la consulta debe estar gestionado y confirmado antes del inicio de la sesión.\n\nQuedamos a su disposición para cualquier duda. ¡Feliz día!"
    },
    PATIENT_APPOINTMENT_REMINDER_CONFIRMATION_VIRTUAL: {
        label: "Patient Appointment Reminder Virtual",
        contentSid: "HX4a988ec65d4afaec679c99b3ac218517",
        template: "Asunto: Recordatorio de cita\n\nBuen día {{1}}, espero que se encuentre muy bien.\n\nLe escribimos para recordarle su próxima cita virtual con {{2}}:\n\nFecha: {{3}}\n\nHora: {{4}}\n\nEnlace de la reunión: : {{5}}\n\nLe recordamos cordialmente que el pago de la consulta debe estar gestionado y confirmado antes del inicio de la sesión.\n\nQuedamos a su disposición para cualquier duda. ¡Feliz día!"
    },
    PATIENT_WELCOME_MESSAGE:{
        label: "Patient Welcome Message",
        contentSid: "HXff54717bfb9d06d77e35910e9fd678f4",
        template: "¡Hola {{1}}! Te damos la bienvenida a Patient Nova, la plataforma de recordatorios de citas de {{2}}. A través de este canal, podrás confirmar o cancelar tus próximas citas de forma rápida. Te recordamos que el pago de la consulta se realiza antes de asistir a tu cita. Banco: {{3}} Número de cuenta:  {{4}} A nombre de: {{5}} Cédula: {{6}} Llave: {{7}} Por favor, descarga y completa este documento de consentimiento adjunto en este mensaje antes de tu primera consulta. ¡Muchas gracias!"
    },
}