export interface BulkTemplateConfig {
  contentSid: string;
  canBulkSend: boolean;
}

export const BULK_TEMPLATE_CONFIG: Record<string, BulkTemplateConfig> = {
  PATIENT_APPOINTMENT_REMINDER_CONFIRMATION_PRESENTIAL: {
    contentSid: 'HX22846eed9e38b750cdc0472e60416b10',
    canBulkSend: false,
  },
  PATIENT_APPOINTMENT_REMINDER_CONFIRMATION_VIRTUAL: {
    contentSid: 'HX4a988ec65d4afaec679c99b3ac218517',
    canBulkSend: false,
  },
  PATIENT_WELCOME_MESSAGE: {
    contentSid: 'HX5e1bff9b1e1afccb0602456fca397773',
    canBulkSend: false,
  },
  PATIENT_CONSENT_DOCUMENT: {
    contentSid: 'HX6950531b8abc3a822cedd8d9578e5383',
    canBulkSend: false,
  },
  PATIENT_PAYMENT_REMINDER: {
    contentSid: 'HX27fd3f66ca6dfef0e59c19f16d381032',
    canBulkSend: false,
  },
};
