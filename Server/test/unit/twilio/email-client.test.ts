import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/utils/config/config.js', () => ({
  config: {
    brevo: {
      apiKey: 'xkeysib-test',
      apiBaseUrl: 'https://api.brevo.test/v3',
      fromEmail: 'no-reply@example.com',
      fromName: 'PatientNova',
    },
  },
}));

vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { sendEmail, textToHtml } from '../../../src/twilio/email-client.js';
import { splitSubjectLine } from '../../../src/twilio/email-subject.js';

const fetchMock = vi.fn();
const MESSAGE_ID = '<202610021200.1234567890@smtp-relay.mailin.fr>';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function sentPayload() {
  const [ , init ] = fetchMock.mock.calls[ 0 ]!;
  return JSON.parse(init.body as string);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sendEmail (Brevo)', () => {
  it('posts text + escaped html with the api-key header and returns the Brevo messageId', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { messageId: MESSAGE_ID }));

    const result = await sendEmail({ to: 'ana@example.com', subject: 'Hola', body: 'Línea 1\n<b>2</b>' });

    const [ url, init ] = fetchMock.mock.calls[ 0 ]!;
    expect(url).toBe('https://api.brevo.test/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'api-key': 'xkeysib-test', 'content-type': 'application/json' });
    expect(sentPayload()).toEqual({
      sender: { email: 'no-reply@example.com', name: 'PatientNova' },
      to: [ { email: 'ana@example.com' } ],
      subject: 'Hola',
      textContent: 'Línea 1\n<b>2</b>',
      htmlContent: 'Línea 1<br>&lt;b&gt;2&lt;/b&gt;',
    });
    expect(result).toMatchObject({ success: true, messageSid: MESSAGE_ID, channel: 'EMAIL', to: 'ana@example.com' });
  });

  it('uses a leading "Asunto:" line as subject when none is given', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { messageId: MESSAGE_ID }));

    await sendEmail({ to: 'ana@example.com', body: 'Asunto: Recordatorio de cita\n\nBuen día Ana' });

    expect(sentPayload()).toMatchObject({ subject: 'Recordatorio de cita', textContent: 'Buen día Ana' });
  });

  it('falls back to the default subject', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { messageId: MESSAGE_ID }));

    await sendEmail({ to: 'ana@example.com', body: 'Hola' });

    expect(sentPayload()).toMatchObject({ subject: 'Recordatorio', textContent: 'Hola' });
  });

  it('rejects an invalid recipient without calling Brevo', async () => {
    await expect(sendEmail({ to: '+573001234567', body: 'Hola' })).rejects.toThrow('Invalid email address');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an empty body without calling Brevo', async () => {
    await expect(sendEmail({ to: 'ana@example.com', body: '   ' })).rejects.toThrow('"body" is required');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws Brevo API errors with the API message and HTTP code', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { code: 'invalid_parameter', message: 'Sender is not valid' }));

    await expect(sendEmail({ to: 'ana@example.com', body: 'Hola' })).rejects.toMatchObject({
      message: 'Sender is not valid',
      code: 400,
    });
  });

  it('throws a status-based error when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('Bad Gateway', { status: 502 }));

    await expect(sendEmail({ to: 'ana@example.com', body: 'Hola' })).rejects.toMatchObject({
      message: 'Brevo responded with status 502',
      code: 502,
    });
  });
});

describe('textToHtml', () => {
  it('escapes HTML and converts newlines', () => {
    expect(textToHtml(`a & "b"\r\n'c'`)).toBe('a &amp; &quot;b&quot;<br>&#39;c&#39;');
  });
});

describe('splitSubjectLine', () => {
  it('returns the text unchanged when there is no subject header', () => {
    expect(splitSubjectLine('Hola\nAna')).toEqual({ subject: null, body: 'Hola\nAna' });
  });

  it('extracts the subject and strips the header and following blank lines', () => {
    expect(splitSubjectLine('Asunto: Cita\n\nHola')).toEqual({ subject: 'Cita', body: 'Hola' });
  });
});
