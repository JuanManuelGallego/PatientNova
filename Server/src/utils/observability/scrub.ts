const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Digit runs with phone punctuation (+, spaces, dashes, dots, parentheses). Not glued to letters or
// dashes, so uuids and identifiers stay readable; masked only when they hold 7+ digits.
const PHONE_CANDIDATE_RE = /(?<![\w-])\+?\(?\d[\d\s().-]{5,}\d(?![\w-])/g;
const ISO_DATE_PREFIX_RE = /^\d{4}-\d{2}-\d{2}(?!\d)/;
// Prisma errors render the failing call, including its argument values (names, notes, ids), after
// "Invalid `<call>()` invocation" ("It occurred in the `<call>()` invocation" for panics). Outside
// production Prisma reads <call> from the source line (`tx.patient.create`), so any receiver must
// match. Only the operation itself is kept.
const PRISMA_INVOCATION_RE = /(?:Invalid|It occurred in the) `[\w$.]+\(\)` invocation/;

function maskNumbers(text: string): string {
  return text.replace(PHONE_CANDIDATE_RE, (match) => {
    const date = ISO_DATE_PREFIX_RE.exec(match);
    if (date) return date[0] + maskNumbers(match.slice(date[0].length));
    return (match.match(/\d/g)?.length ?? 0) >= 7 ? '[number]' : match;
  });
}

/**
 * Masks emails, phone-like numbers and Prisma call arguments. Names and free text (clinical notes)
 * cannot be recognized, so error messages must never interpolate them in the first place.
 */
export function scrubText(text: string): string {
  const prisma = PRISMA_INVOCATION_RE.exec(text);
  if (prisma) return `${prisma[0]} [details removed]`;
  return maskNumbers(text.replace(EMAIL_RE, '[email]'));
}

function stripQuery(url: string): string {
  const i = url.search(/[?#]/);
  return i === -1 ? url : url.slice(0, i);
}

interface ScrubbableEvent {
  message?: string;
  exception?: { values?: Array<{ value?: string }> };
  request?: { url?: string; data?: unknown; cookies?: unknown; headers?: unknown; query_string?: unknown };
  user?: { id?: string | number } & Record<string, unknown>;
  extra?: unknown;
  breadcrumbs?: unknown;
}

/**
 * Removes personal data from an error event before it leaves the server: no request bodies,
 * cookies, headers or query strings; the user is reduced to an id; emails/phone numbers inside
 * messages are masked. Patient and provider data must never reach a third-party error tracker.
 */
export function scrubEvent<T extends object>(input: T): T {
  const event = input as unknown as ScrubbableEvent;
  if (event.message) event.message = scrubText(event.message);
  for (const v of event.exception?.values ?? []) {
    if (v.value) v.value = scrubText(v.value);
  }
  if (event.request) {
    const { url } = event.request;
    event.request = url ? { url: stripQuery(url) } : {};
  }
  if (event.user) event.user = event.user.id !== undefined ? { id: event.user.id } : {};
  delete event.extra;
  delete event.breadcrumbs;
  return input;
}
