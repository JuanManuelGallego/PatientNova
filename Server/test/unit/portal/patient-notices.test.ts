import { describe, expect, it } from 'vitest';
import { Channel } from '../../../generated/prisma/enums.js';
import { config } from '../../../src/utils/config/config.js';
import {
  confirmationUrl,
  renderPatientNotice,
  type PatientNoticeKind,
  type PatientNoticeParams,
} from '../../../src/portal/patient-notices.js';
import type { PatientRoute } from '../../../src/portal/patient-route.js';
import type { DispatchOpts } from '../../../src/scheduler/dispatch.js';

const timed = { providerName: 'Dra. Ana Pública', at: new Date('2027-01-20T15:00:00Z'), timezone: 'America/Bogota' };
const links = { appointmentsUrl: 'https://app.test/book/dra/appointments', bookingUrl: 'https://app.test/book/dra' };
const place = { locationName: 'Consultorio Centro', address: 'Calle 10 # 5-20' };

const contact = { phone: '+573001234567', whatsapp: null };
const token = 'tok_abc-123';
const confirmUrl = confirmationUrl(token);

const PARAMS: PatientNoticeParams = {
  confirmation: { ...timed, ...place, appointmentsUrl: links.appointmentsUrl },
  cancellation: { ...timed, bookingUrl: links.bookingUrl },
  reschedule: { ...timed, ...place, appointmentsUrl: links.appointmentsUrl, previousAt: new Date('2027-01-19T15:00:00Z') },
  'meeting-link': { ...timed, meetingUrl: 'https://meet.google.com/abc', appointmentsUrl: links.appointmentsUrl },
  'request-rejected': { ...timed, bookingUrl: links.bookingUrl },
  'request-expired': { ...timed, bookingUrl: links.bookingUrl },
  'confirm-link': { ...timed, ...place, token, confirmUrl, approvalRequired: false, providerContact: contact },
  'unconfirmed-expired': { ...timed, bookingUrl: links.bookingUrl },
};

const KINDS = Object.keys(PARAMS) as PatientNoticeKind[];
const WHATSAPP = { channel: Channel.WHATSAPP, to: '+573001112233' };
const SMS = { channel: Channel.SMS, to: '+573001112233' };
const EMAIL = { channel: Channel.EMAIL, to: 'ana@example.com' };

function textOf(opts: DispatchOpts): string {
  return [ opts.subject, opts.body, ...Object.values(opts.contentVariables ?? {}) ].filter(Boolean).join('\n');
}

const render = (kind: PatientNoticeKind, route: PatientRoute) =>
  renderPatientNotice(kind, PARAMS[kind] as never, route);

describe('renderPatientNotice', () => {
  it.each(KINDS)('%s on WhatsApp is a template with no empty or multi-line variable', (kind) => {
    const opts = render(kind, WHATSAPP);
    expect(opts.to).toBe(WHATSAPP.to);
    expect(opts.contentSid).toBeTruthy();
    expect(opts.body).toBeUndefined();
    const variables = Object.values(opts.contentVariables ?? {});
    expect(variables.length).toBeGreaterThan(0);
    for (const value of variables) expect(value).toMatch(/^\S.*\S$/);
  });

  it.each(KINDS)('%s on SMS is one line', (kind) => {
    const opts = render(kind, SMS);
    expect(opts.to).toBe(SMS.to);
    expect(opts.contentSid).toBeUndefined();
    expect(opts.subject).toBeUndefined();
    expect(opts.body).toContain('Dra. Ana Pública');
    expect(opts.body).not.toMatch(/\n/);
  });

  it.each(KINDS)('%s on email keeps a subject and a body', (kind) => {
    const opts = render(kind, EMAIL);
    expect(opts.to).toBe(EMAIL.to);
    expect(opts.subject).toContain('Dra. Ana Pública');
    expect(opts.body).toBeTruthy();
    expect(opts.contentSid).toBeUndefined();
  });

  it.each([
    [ 'confirmation', config.twilio.patientPortal.confirmationSid ],
    [ 'cancellation', config.twilio.patientPortal.cancelSid ],
    [ 'reschedule', config.twilio.patientPortal.rescheduleSid ],
    [ 'meeting-link', config.twilio.appointmentMeetingLinkSid ],
    [ 'request-rejected', config.twilio.patientPortal.requestRejectedSid ],
    [ 'request-expired', config.twilio.patientPortal.requestExpiredSid ],
    [ 'confirm-link', config.twilio.patientPortal.confirmLinkSid ],
    [ 'unconfirmed-expired', config.twilio.patientPortal.unconfirmedExpiredSid ],
  ] as const)('%s uses its own template', (kind, sid) => {
    expect(render(kind, WHATSAPP).contentSid).toBe(sid);
  });

  it('fills the variables each approved template expects', () => {
    expect(render('confirmation', WHATSAPP).contentVariables).toEqual({
      '1': 'Dra. Ana Pública',
      '2': expect.stringContaining('20 de enero de 2027'),
      '3': '10:00 a. m.',
      '4': 'Consultorio Centro, Calle 10 # 5-20',
    });
    expect(render('reschedule', WHATSAPP).contentVariables).toEqual({
      '1': 'Dra. Ana Pública',
      '2': expect.stringContaining('19 de enero de 2027'),
      '3': expect.stringContaining('20 de enero de 2027'),
      '4': '10:00 a. m.',
      '5': 'Consultorio Centro, Calle 10 # 5-20',
    });
    expect(render('meeting-link', WHATSAPP).contentVariables).toEqual({ '1': 'Dra. Ana Pública', '2': 'https://meet.google.com/abc' });
  });

  it('uses the link, or the text saying it will follow, as the place of a virtual appointment', () => {
    const virtual = { ...timed, appointmentsUrl: links.appointmentsUrl, locationName: 'Virtual', address: null };
    const ready = renderPatientNotice('confirmation', { ...virtual, meetingUrl: 'https://meet.google.com/abc' }, WHATSAPP);
    expect(ready.contentVariables?.['4']).toBe('https://meet.google.com/abc');
    const pending = renderPatientNotice('confirmation', { ...virtual, meetingUrl: null, meetingPending: true }, WHATSAPP);
    expect(pending.contentVariables?.['4']).toBe('Te enviaremos el enlace pronto');
  });

  it('never leaves the place variable empty, and joins a multi-line address on one line', () => {
    const base = { ...timed, appointmentsUrl: links.appointmentsUrl };
    expect(renderPatientNotice('confirmation', { ...base, locationName: null, address: null }, WHATSAPP).contentVariables?.['4'])
      .toBe('Por confirmar');
    expect(renderPatientNotice('confirmation', { ...base, locationName: 'Sede', address: 'Calle 1\n  Piso 2' }, WHATSAPP).contentVariables?.['4'])
      .toBe('Sede, Calle 1 Piso 2');
  });

  it.each(KINDS.flatMap((kind) => [ [ kind, WHATSAPP ], [ kind, SMS ], [ kind, EMAIL ] ] as const))(
    '%s never has a full stop right after a time',
    (kind, route) => {
      expect(textOf(render(kind, route))).not.toMatch(/[ap]\. m\.\./);
    },
  );

  it.each(KINDS.flatMap((kind) => [ [ kind, WHATSAPP ], [ kind, SMS ] ] as const))(
    '%s on a phone channel carries no appointment type or patient details',
    (kind, route) => {
      const params = { ...PARAMS[kind], typeName: 'Terapia de pareja', patientName: 'Lucía Rojas', notes: 'Nota clínica' };
      const text = textOf(renderPatientNotice(kind, params as never, route));
      expect(text).not.toContain('Terapia');
      expect(text).not.toContain('Lucía');
      expect(text).not.toContain('Nota clínica');
    },
  );

  describe('confirmation link', () => {
    const emailOf = (kind: PatientNoticeKind, params: object) =>
      renderPatientNotice(kind, params as never, EMAIL) as { subject: string; body: string };

    it('builds the link from the portal base', () => {
      expect(confirmationUrl('abc')).toBe(`${config.portal.url.replace(/\/+$/, '')}/book/confirmar/abc`);
    });

    it('confirm-link by WhatsApp uses the confirm-link template with the token as the URL-button variable', () => {
      const opts = render('confirm-link', WHATSAPP);
      expect(opts).toMatchObject({
        contentSid: config.twilio.patientPortal.confirmLinkSid,
        contentVariables: { '1': 'Dra. Ana Pública', '2': expect.any(String), '3': expect.stringMatching(/m\.$/), '4': token },
      });
      expect(Object.keys(opts.contentVariables ?? {})).toEqual([ '1', '2', '3', '4' ]);
    });

    it('confirm-link by email says the appointment is not confirmed until the click, links confirmUrl, and names the 15-minute limit', () => {
      const { subject, body } = emailOf('confirm-link', PARAMS['confirm-link']);
      expect(subject).toBe('Confirma tu cita con Dra. Ana Pública');
      expect(body).toContain('no está confirmada');
      expect(body).toContain(confirmUrl);
      expect(body).toContain('15 minutos');
      expect(body).toContain('Lugar: Consultorio Centro');
    });

    it('confirm-link email names the time zone of the time and tells a stranger to ignore it', () => {
      for (const approvalRequired of [ false, true ]) {
        const { body } = emailOf('confirm-link', { ...PARAMS['confirm-link'], approvalRequired });
        expect(body).toMatch(/del miércoles, 20 de enero de 2027, 10:00 a\. m\. \(hora de America\/Bogota\) todavía no/);
        expect(body).toContain('Si no hiciste esta reserva, ignora este mensaje.');
      }
    });

    it('confirm-link email in approval mode says the request has not been sent', () => {
      const { subject, body } = emailOf('confirm-link', { ...PARAMS['confirm-link'], approvalRequired: true });
      expect(subject).toBe('Confirma tu solicitud de cita con Dra. Ana Pública');
      expect(body).toContain('todavía no se ha enviado');
      expect(body).toContain('15 minutos');
    });

    it('confirm-link email shows only the location name for a virtual place', () => {
      const { body } = emailOf('confirm-link', { ...PARAMS['confirm-link'], locationName: 'Virtual', address: null, meetingUrl: null, meetingPending: true });
      expect(body).toContain('Lugar: Virtual');
      expect(body).not.toContain('videollamada');
    });

    it('confirm-link email tells the patient to contact the provider to change or cancel', () => {
      const { body } = emailOf('confirm-link', PARAMS['confirm-link']);
      expect(body).toContain('comunícate directamente');
      expect(body).toContain('+573001234567');
      expect(body).not.toContain('WhatsApp +');
    });

    it('the contact line names both phone and WhatsApp, and is absent when the provider has neither', () => {
      const both = emailOf('confirm-link', { ...PARAMS['confirm-link'], providerContact: { phone: '+57300', whatsapp: '+57311' } }).body;
      expect(both).toContain('comunícate directamente con Dra. Ana Pública: +57300 o WhatsApp +57311');
      const onlyWa = emailOf('confirm-link', { ...PARAMS['confirm-link'], providerContact: { phone: null, whatsapp: '+57311' } }).body;
      expect(onlyWa).toContain('Dra. Ana Pública: WhatsApp +57311');
      const none = emailOf('confirm-link', { ...PARAMS['confirm-link'], providerContact: { phone: null, whatsapp: null } }).body;
      expect(none).not.toContain('comunícate');
    });

    it('unconfirmed-expired by WhatsApp uses its own template, never request-expired', () => {
      const opts = render('unconfirmed-expired', WHATSAPP);
      expect(opts.contentSid).toBe(config.twilio.patientPortal.unconfirmedExpiredSid);
      expect(opts.contentSid).not.toBe(config.twilio.patientPortal.requestExpiredSid);
      expect(Object.keys(opts.contentVariables ?? {})).toEqual([ '1', '2', '3' ]);
    });

    it('unconfirmed-expired email says it was not confirmed and links to book again', () => {
      const { subject, body } = emailOf('unconfirmed-expired', PARAMS['unconfirmed-expired']);
      expect(subject).toBe('Tu reserva con Dra. Ana Pública no se confirmó');
      expect(body).toContain('No confirmaste tu cita del');
      expect(body).toContain(`Puedes reservar de nuevo aquí: ${links.bookingUrl}`);
    });

    it('no WhatsApp variable is empty for a provider without publicWhatsapp', () => {
      const opts = renderPatientNotice('confirm-link', { ...PARAMS['confirm-link'], providerContact: { phone: null, whatsapp: null } }, WHATSAPP);
      for (const value of Object.values(opts.contentVariables ?? {})) expect(value).toMatch(/^\S.*\S$/);
    });
  });
});
