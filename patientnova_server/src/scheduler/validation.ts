import { Channel, type Reminder } from "../../generated/prisma/client.ts";

type ValidationResult = { isValid: boolean; error?: string };

export function validateReminder(reminder: Reminder): ValidationResult {
  if (!reminder.channel) return { isValid: false, error: "Missing channel for reminder" };
  if (!reminder.to) return { isValid: false, error: `No recipient for channel ${reminder.channel}` };

  if (reminder.channel === Channel.WHATSAPP) {
    if (!reminder.contentSid) return { isValid: false, error: "Missing contentSid for WhatsApp message" };
    if (reminder.contentVariables && typeof reminder.contentVariables !== "object") {
      return { isValid: false, error: "Invalid contentVariables format" };
    }
  }

  if (reminder.channel === Channel.SMS || reminder.channel === Channel.EMAIL) {
    if (!reminder.body) return { isValid: false, error: `Missing body for ${reminder.channel} message` };
  }

  return { isValid: true };
}
