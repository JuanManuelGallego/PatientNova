export type NotificationChannel = 'whatsapp' | 'sms';

export interface SendWhatsAppRequest {
  to: string;
  contentSid: string;
  contentVariables?: Record<string, string>;
}

export interface SendSmsRequest {
  to: string;
  body: string;
}

export interface ScheduleRequest {
  channel: NotificationChannel;
  payload: SendWhatsAppRequest | SendSmsRequest;
  sendAt: string;
}

export interface NotificationResult {
  success: boolean;
  messageSid?: string;
  channel: NotificationChannel;
  to: string;
  sentAt: string;
  error?: string;
}

export interface ScheduleResult {
  jobId: string;
  channel: NotificationChannel;
  to: string;
  sendAt: string;
  scheduledAt: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}
