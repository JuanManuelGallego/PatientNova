const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// 8+ digits, optionally with +, spaces or dashes: phone numbers and long ids.
const PHONE_RE = /\+?\d[\d\s-]{6,}\d/g;

export function scrubText(text: string): string {
  return text.replace(EMAIL_RE, '[email]').replace(PHONE_RE, '[number]');
}

function stripQuery(url: string): string {
  const i = url.indexOf('?');
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
