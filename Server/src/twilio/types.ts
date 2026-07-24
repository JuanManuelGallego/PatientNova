import type { Channel } from '../../generated/prisma/client.ts';

export interface SendWhatsAppRequest {
  to: string;
  contentSid: string;
  contentVariables?: Record<string, string>;
  mediaUrl?: string | null;
}

export interface SendSmsRequest {
  to: string;
  body: string;
}

export interface ScheduleRequest {
  channel: Channel;
  payload: SendWhatsAppRequest /*| SendSmsRequest*/;
  sendAt: string;
}

export interface NotificationResult {
  success: boolean;
  messageSid?: string;
  channel: Channel;
  to: string;
  sentAt: string;
  error?: string;
}

export interface ScheduleResult {
  jobId: string;
  channel: Channel;
  to: string;
  sentAt: string;
  sendAt: string;
}

export type TrackedReminder = {
  dbId: string;
  messageSid: string;
  trackedSince: number;
  pollFailures: number;
};

export type SendResult = {
  success: boolean;
  error?: string;
  messageSid: string | null;
};
