import { Channel } from "../../generated/prisma/client.ts";
import { sendSms, sendWhatsApp } from "../twilio/twilioClient.js";
import type { NotificationResult } from "../utils/types.ts";
import { logger } from "../utils/logger.ts";

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

    case Channel.EMAIL:
      logger.warn({ channel, to: opts.to }, 'EMAIL channel not yet implemented — message will not be sent');
      return { success: false, error: "EMAIL channel not yet implemented", messageSid: "N/A", channel: channel, to: opts.to, sentAt: new Date().toISOString() };

    default:
      logger.warn({ channel, to: opts.to }, 'Unsupported dispatch channel');
      return { success: false, error: `Unsupported channel: ${channel}`, messageSid: "N/A", channel: channel, to: opts.to, sentAt: new Date().toISOString() };
  }
}
