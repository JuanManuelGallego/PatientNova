import { logger, maskEmail } from '../utils/api/logger.js';
import { sendEmail } from './email-client.js';
import type { RenderedEmail } from './email-templates.js';

/**
 * Sends a patient-facing transactional email and NEVER throws or exposes provider error text:
 * public callers only learn whether it was accepted. Details go to the server log (masked).
 */
export async function sendTransactionalEmail(to: string, email: RenderedEmail): Promise<{ sent: boolean }> {
  try {
    await sendEmail({ to, subject: email.subject, body: email.body });
    return { sent: true };
  } catch (err) {
    const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code: unknown }).code : undefined;
    logger.error({ maskedTo: maskEmail(to), code, name: err instanceof Error ? err.name : undefined }, 'Transactional email failed');
    return { sent: false };
  }
}
