import type express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), send: vi.fn() }));
vi.mock('../../../src/scheduler/dispatch.js', () => ({ dispatchMessage: mocks.dispatch }));
vi.mock('../../../src/scheduler/pg-boss.js', () => ({ getBoss: () => ({ send: mocks.send }) }));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import { appointmentService } from '../../../src/appointments/appointment.service.js';
import { AppointmentMeetingUrlRequiredError } from '../../../src/appointments/appointment.errors.js';
import { googleConnectionRepository, REQUIRED_SCOPE } from '../../../src/google/google-connection.repository.js';
import { findNeedsMeetingLink } from '../../../src/portal/portal-meeting.service.js';
import { MEETING_LINK_PENDING_LINE } from '../../../src/brevo/email-templates.js';
import { AppointmentStatus, Channel, MeetingStatus } from '../../../generated/prisma/enums.js';
import { createTestLocation, unique } from '../helpers.js';
import {
  buildPortalApp,
  createConsentedPatient,
  createLiveProvider,
  portalBookingBody,
  portalPost,
  sessionFor,
  slotStarts,
  type LiveProvider,
} from './portal-helpers.js';

let app: express.Express;
const portal = config.portal as { patientEnabled: boolean };
const portalWas = portal.patientEnabled;
beforeAll(() => { portal.patientEnabled = true; });
afterAll(() => { portal.patientEnabled = portalWas; });
const scheduler = config.scheduler as { enabled: boolean };
const schedulerWas = scheduler.enabled;
afterAll(() => { scheduler.enabled = schedulerWas; });
beforeEach(() => {
  app = buildPortalApp();
  scheduler.enabled = false;
  mocks.dispatch.mockReset().mockResolvedValue({ success: true, messageSid: 'msg-1' });
  mocks.send.mockReset().mockResolvedValue('job-1');
});

const HOUR = 3600_000;
const LINK = 'https://zoom.example/j/123';

/** A live provider whose only bookable location is a video call. */
async function virtualProvider(opts: { google?: boolean } = {}) {
  const provider = await createLiveProvider();
  await prisma.appointmentLocation.update({ where: { id: provider.locationId }, data: { bookableOnline: false } });
  const virtual = await createTestLocation(provider.id, { isVirtual: true });
  await prisma.appointmentLocation.update({ where: { id: virtual.id }, data: { bookableOnline: true, address: null, instructions: null } });
  await prisma.user.update({ where: { id: provider.id }, data: { reminderActive: true, reminderChannel: Channel.EMAIL } });
  if (opts.google) {
    await googleConnectionRepository.upsertConnection(provider.id, { refreshToken: 'refresh-token', grantedScopes: [ REQUIRED_SCOPE ] });
  }
  return { ...provider, locationId: virtual.id } satisfies LiveProvider;
}

async function book(provider: LiveProvider, daysAhead = 3) {
  const [ start ] = await slotStarts(provider, daysAhead);
  const session = sessionFor(provider.id, unique('virtual@test.local'));
  const res = await portalPost(app, '/v1/portal/bookings', session, portalBookingBody(provider, start!));
  expect(res.status).toBe(201);
  return { session, start: start!, dto: res.body.data.appointment, id: res.body.data.appointment.id as string };
}

const appointment = (id: string) => prisma.appointment.findUniqueOrThrow({ where: { id }, include: { reminder: true } });
const sentEmails = () => mocks.dispatch.mock.calls.map(([ , opts ]) => opts as { to: string; subject: string; body: string });
const queued = (queue: string) => mocks.send.mock.calls.filter(([ q ]) => q === queue);

describe('portal booking at a virtual location', () => {
  it('with Google connected: PENDING, a provision-meet job on the transaction, and only the provider notice', async () => {
    scheduler.enabled = true;
    const provider = await virtualProvider({ google: true });
    const { id, dto } = await book(provider);

    const appt = await appointment(id);
    expect(appt).toMatchObject({ meetingStatus: MeetingStatus.PENDING, meetingUrl: null });
    expect(dto.meeting).toEqual({ status: 'pending' });
    expect(dto.location).toMatchObject({ isVirtual: true, address: null });

    expect(queued('provision-meet')).toEqual([
      [ 'provision-meet', { appointmentId: id }, { db: expect.anything(), singletonKey: id } ],
    ]);
    expect(queued('portal-booking-notify').map(([ , job ]) => job.kind)).toEqual([ 'provider-notice' ]);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('without Google (or without the scheduler): NEEDS_LINK and a confirmation saying the link will follow', async () => {
    const provider = await virtualProvider();
    const { id, session, dto } = await book(provider);

    const appt = await appointment(id);
    expect(appt.meetingStatus).toBe(MeetingStatus.NEEDS_LINK);
    expect(dto.meeting).toEqual({ status: 'pending' });
    const [ toPatient ] = sentEmails().filter((e) => e.to === session.email);
    expect(toPatient!.body).toContain(MEETING_LINK_PENDING_LINE);
    expect(toPatient!.body).not.toContain('Dirección');
    expect(toPatient!.body).not.toMatch(/\{\{\d+\}\}/);
    expect(appt.reminder?.body).toContain('Te enviaremos el enlace por correo');
    expect(appt.reminder?.body).not.toMatch(/\{\{\d+\}\}/);

    expect(await findNeedsMeetingLink(provider.id)).toEqual({ count: 1, appointments: [ { id, startAt: appt.startAt } ] });
  });

  it('with the scheduler on but no Google: NEEDS_LINK, both notices queued, no Meet job', async () => {
    scheduler.enabled = true;
    const provider = await virtualProvider();
    const { id } = await book(provider);
    expect((await appointment(id)).meetingStatus).toBe(MeetingStatus.NEEDS_LINK);
    expect(queued('provision-meet')).toHaveLength(0);
    expect(queued('portal-booking-notify').map(([ , job ]) => job.kind)).toEqual([ 'patient-confirmation', 'provider-notice' ]);
  });

  it('rolls the booking back when the Meet job cannot be queued', async () => {
    scheduler.enabled = true;
    const provider = await virtualProvider({ google: true });
    mocks.send.mockImplementation(async (queue: string) => {
      if (queue === 'provision-meet') throw new Error('queue down');
      return 'job-1';
    });
    const [ start ] = await slotStarts(provider);
    const res = await portalPost(app, '/v1/portal/bookings', sessionFor(provider.id, unique('rb@test.local')), portalBookingBody(provider, start!));
    expect(res.status).toBe(500);
    expect(await prisma.appointment.count({ where: { userId: provider.id } })).toBe(0);
  });

  it('a reschedule keeps the link and its status, and virtual bookings can be rescheduled', async () => {
    const provider = await virtualProvider();
    const { id, session, dto } = await book(provider, 3);
    expect(dto.canReschedule).toBe(true);
    await appointmentService.update(id, { meetingUrl: LINK }, provider.id);

    const [ to ] = await slotStarts(provider, 4);
    const res = await portalPost(app, `/v1/portal/appointments/${id}/reschedule`, session, { startUtc: to, patientTimezone: 'America/Bogota' });
    expect(res.status).toBe(200);
    expect(res.body.data.appointment.meeting).toEqual({ status: 'ready', url: LINK });
    expect(await appointment(id)).toMatchObject({ meetingUrl: LINK, meetingStatus: MeetingStatus.READY });
    const reschedule = sentEmails().find((e) => e.to === session.email && e.subject.startsWith('Cita reprogramada'));
    expect(reschedule!.body).toContain(`Enlace de la videollamada: ${LINK}`);
  });
});

describe('the provider adds the link', () => {
  it('NEEDS_LINK + a URL → READY, the reminder re-rendered and a link email to the patient', async () => {
    const provider = await virtualProvider();
    const { id, session } = await book(provider);
    mocks.dispatch.mockClear();

    await appointmentService.update(id, { meetingUrl: LINK }, provider.id);

    const appt = await appointment(id);
    expect(appt).toMatchObject({ meetingUrl: LINK, meetingStatus: MeetingStatus.READY });
    expect(appt.reminder?.body).toContain(LINK);
    const emails = sentEmails();
    expect(emails).toHaveLength(1);
    expect(emails[ 0 ]).toMatchObject({ to: session.email, subject: expect.stringMatching(/^Enlace de tu videollamada con /) });
    expect(emails[ 0 ]!.body).toContain(LINK);
    expect(await findNeedsMeetingLink(provider.id)).toEqual({ count: 0, appointments: [] });

    const audit = await prisma.auditLog.findFirst({ where: { entityId: id, affectedFields: { has: 'meetingStatus' } } });
    expect(audit?.fieldsAfter).toMatchObject({ meetingStatus: MeetingStatus.READY });
  });

  it('PENDING + a URL → READY and the held confirmation, queued on the transaction', async () => {
    scheduler.enabled = true;
    const provider = await virtualProvider({ google: true });
    const { id } = await book(provider);
    mocks.send.mockClear();

    await appointmentService.update(id, { meetingUrl: LINK }, provider.id);
    expect((await appointment(id)).meetingStatus).toBe(MeetingStatus.READY);
    expect(queued('portal-booking-notify')).toEqual([
      [ 'portal-booking-notify', { appointmentId: id, kind: 'patient-confirmation' }, { db: expect.anything() } ],
    ]);
  });

  it('other edits keep NEEDS_LINK; a cleared READY link is still refused', async () => {
    const provider = await virtualProvider();
    const { id } = await book(provider);
    await appointmentService.update(id, { notes: 'Primera sesión', meetingUrl: '' }, provider.id);
    expect(await appointment(id)).toMatchObject({ notes: 'Primera sesión', meetingStatus: MeetingStatus.NEEDS_LINK, meetingUrl: null });

    await appointmentService.update(id, { meetingUrl: LINK }, provider.id);
    await expect(appointmentService.update(id, { meetingUrl: '' }, provider.id)).rejects.toBeInstanceOf(AppointmentMeetingUrlRequiredError);
    expect((await appointment(id)).meetingUrl).toBe(LINK);
  });

  it('a changed READY link sends the new one; a cancelled appointment gets nothing', async () => {
    const provider = await virtualProvider();
    const { id, session } = await book(provider);
    await appointmentService.update(id, { meetingUrl: LINK }, provider.id);
    mocks.dispatch.mockClear();

    await appointmentService.update(id, { meetingUrl: 'https://meet.example/nuevo' }, provider.id);
    expect(sentEmails().map((e) => e.to)).toEqual([ session.email ]);

    await appointmentService.setStatus(id, provider.id, AppointmentStatus.CANCELLED);
    mocks.dispatch.mockClear();
    await appointmentService.update(id, { meetingUrl: LINK }, provider.id);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it('provider-created virtual appointments still require a URL', async () => {
    const provider = await virtualProvider();
    const patient = await createConsentedPatient(provider.id);
    const start = new Date(Date.now() + 5 * 24 * HOUR);
    await expect(appointmentService.create({
      patientId: patient.id, locationId: provider.locationId, typeId: provider.typeId, price: 0,
      startAt: start.toISOString(), endAt: new Date(start.getTime() + HOUR).toISOString(),
    } as never, provider.id)).rejects.toBeInstanceOf(AppointmentMeetingUrlRequiredError);
  });
});
