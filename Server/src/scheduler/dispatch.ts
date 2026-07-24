import { Channel } from "../../generated/prisma/client.ts";
import { sendSms, sendWhatsApp } from "../twilio/client.js";
import type { NotificationResult } from "../twilio/types.ts";
import { logger } from "../utils/api/logger.ts";

export interface DispatchOpts {
  to: string;
  body?: string | null;
  contentSid?: string | null;
  contentVariables?: Record<string, string> | undefined
};

export async function dispatchMessage(channel: Channel, opts: DispatchOpts): Promise<NotificationResult> {
  switch (channel) {
    case Channel.WHATSAPP:
      return sendWhatsApp({
        to: opts.to,
        contentSid: opts.contentSid!,
        ...(opts.contentVariables && { contentVariables: opts.contentVariables }),
      });

    case Channel.SMS:
      return sendSms({ to: opts.to, body: opts.body! });

    default:
      logger.warn({ channel, to: opts.to }, 'Unsupported dispatch channel');
      return { success: false, error: `Unsupported channel: ${channel}`, messageSid: "N/A", channel: channel, to: opts.to, sentAt: new Date().toISOString() };
  }
}
