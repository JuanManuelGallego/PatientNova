import { config } from '../utils/config/config.js';
import { logger } from '../utils/api/logger.js';
import { DEFAULT_EMAIL_SUBJECT } from '../utils/config/constants.js';
import { Channel } from '../../generated/prisma/client.ts';
import type { NotificationResult, SendEmailRequest } from '../twilio/types.js';
import { validateEmail } from '../twilio/validator.js';
import { splitSubjectLine } from '../twilio/email-subject.js';

/** Brevo transactional email endpoint: https://developers.brevo.com/reference/sendtransacemail */
function sendEndpoint(): string {
  return `${config.brevo.apiBaseUrl.replace(/\/$/, '')}/smtp/email`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function textToHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, '<br>');
}

/** Builds an Error carrying Brevo's readable message and `code` (HTTP status). */
async function toSendError(response: Response): Promise<Error> {
  let detail: string | undefined;
  try {
    const payload = (await response.json()) as { message?: string; code?: string };
    detail = payload.message ?? payload.code;
  } catch {
    // Non-JSON error body — fall back to the status text below.
  }
  const err = new Error(detail ?? `Brevo responded with status ${response.status}`) as Error & { code?: number };
  err.code = response.status;
  return err;
}

export async function sendEmail(req: SendEmailRequest): Promise<NotificationResult> {
  validateEmail(req.to);

  if (!req.body?.trim()) {
    throw new Error('"body" is required and cannot be empty');
  }

  // Without an explicit subject, a leading "Asunto: ..." template line becomes the subject.
  const explicitSubject = req.subject?.trim();
  const { subject: headerSubject, body } = explicitSubject
    ? { subject: null, body: req.body }
    : splitSubjectLine(req.body);
  const subject = explicitSubject || headerSubject || DEFAULT_EMAIL_SUBJECT;
  logger.debug({ to: req.to }, 'Sending email');

  const response = await fetch(sendEndpoint(), {
    method: 'POST',
    headers: {
      'api-key': config.brevo.apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        email: config.brevo.fromEmail,
        ...(config.brevo.fromName && { name: config.brevo.fromName }),
      },
      to: [ { email: req.to } ],
      subject,
      textContent: body,
      htmlContent: textToHtml(body),
    }),
  });

  if (!response.ok) {
    throw await toSendError(response);
  }

  const { messageId } = (await response.json()) as { messageId?: string };
  logger.debug({ messageId, statusCode: response.status }, 'Email accepted by Brevo');

  return {
    success: true,
    ...(messageId ? { messageSid: messageId } : {}),
    channel: Channel.EMAIL,
    to: req.to,
    sentAt: new Date().toISOString(),
  };
}
