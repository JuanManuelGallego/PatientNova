import { config } from '../utils/config/config.js';
import { logger, maskEmail } from '../utils/api/logger.js';
import { DEFAULT_EMAIL_SUBJECT } from '../utils/config/constants.js';
import { Channel } from '../../generated/prisma/client.ts';
import type { NotificationResult, SendEmailRequest } from '../twilio/types.js';
import { validateEmail } from '../twilio/validator.js';
import { splitSubjectLine } from '../twilio/email-subject.js';

const DEFAULT_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 500;
// Only statuses where Brevo definitively did NOT process the request are retried (a retry after an
// ambiguous failure such as a timeout could deliver the email twice).
const RETRYABLE_STATUSES = new Set([ 429, 503 ]);

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
  logger.debug({ maskedTo: maskEmail(req.to) }, 'Sending email');

  const payload = JSON.stringify({
    sender: {
      email: config.brevo.fromEmail,
      ...(config.brevo.fromName && { name: config.brevo.fromName }),
    },
    to: [ { email: req.to } ],
    subject,
    textContent: body,
    htmlContent: textToHtml(body),
  });

  const post = () => fetch(sendEndpoint(), {
    method: 'POST',
    headers: {
      'api-key': config.brevo.apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: payload,
    signal: AbortSignal.timeout(config.brevo.timeoutMs || DEFAULT_TIMEOUT_MS),
  });

  let response = await post();
  if (RETRYABLE_STATUSES.has(response.status)) {
    logger.warn({ status: response.status }, 'Brevo asked us to retry; retrying once');
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    response = await post();
  }

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
