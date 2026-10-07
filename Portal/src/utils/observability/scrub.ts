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

interface BrowserEvent {
  message?: string;
  exception?: { values?: Array<{ value?: string }> };
  request?: { url?: string; headers?: unknown; cookies?: unknown; query_string?: unknown; data?: unknown };
  user?: unknown;
  breadcrumbs?: unknown;
  extra?: unknown;
}

/** Strips personal data from browser error events before they are sent (see Server scrub). */
export function scrubBrowserEvent<T extends object>(input: T): T {
  const event = input as unknown as BrowserEvent;
  if (event.message) event.message = scrubText(event.message);
  for (const v of event.exception?.values ?? []) {
    if (v.value) v.value = scrubText(v.value);
  }
  if (event.request) {
    const { url } = event.request;
    event.request = url ? { url: stripQuery(url) } : {};
  }
  delete event.user;
  delete event.extra;
  delete event.breadcrumbs;
  return input;
}
