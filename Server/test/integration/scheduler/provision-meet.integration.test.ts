import type express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), send: vi.fn(), createMeetingSpace: vi.fn() }));
vi.mock('../../../src/scheduler/dispatch.js', () => ({ dispatchMessage: mocks.dispatch }));
vi.mock('../../../src/scheduler/pg-boss.js', () => ({ getBoss: () => ({ send: mocks.send }) }));
vi.mock('../../../src/google/google-meet.service.js', () => ({ googleMeetService: { createMeetingSpace: mocks.createMeetingSpace } }));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import { PROVISION_MEET_RETRY_LIMIT } from '../../../src/utils/config/constants.js';
import { GoogleOAuthError } from '../../../src/google/google-errors.js';
import { googleConnectionRepository, REQUIRED_SCOPE } from '../../../src/google/google-connection.repository.js';
import { appointmentService } from '../../../src/appointments/appointment.service.js';
import { provisionMeetWorker } from '../../../src/scheduler/workers/provision-meet.js';
import { sweepPendingMeetingsWorker } from '../../../src/scheduler/workers/sweep-pending-meetings.js';
import { deliverBookingNotification } from '../../../src/portal/portal-booking-notifications.js';
import { MEETING_LINK_PENDING_LINE } from '../../../src/brevo/email-templates.js';
import { ActionSource, AppointmentStatus, Channel, MeetingStatus } from '../../../generated/prisma/enums.js';
import { createTestLocation, unique } from '../helpers.js';
import { buildPortalApp, createLiveProvider, portalBookingBody, portalPost, sessionFor, slotStarts } from '../portal/portal-helpers.js';

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
  scheduler.enabled = true;
  mocks.dispatch.mockReset().mockResolvedValue({ success: true, messageSid: 'msg-1' });
  mocks.send.mockReset().mockResolvedValue('job-1');
  mocks.createMeetingSpace.mockReset().mockResolvedValue({ meetingUrl: 'https://meet.google.com/abc-defg-hij', spaceName: 'spaces/abc' });
});

const MEET = 'https://meet.google.com/abc-defg-hij';

/** A PENDING portal appointment: a provider with Google connected and a bookable virtual location. */
async function pendingBooking() {
  const provider = await createLiveProvider();
  await prisma.appointmentLocation.update({ where: { id: provider.locationId }, data: { bookableOnline: false } });
  const virtual = await createTestLocation(provider.id, { isVirtual: true });
  await prisma.appointmentLocation.update({ where: { id: virtual.id }, data: { bookableOnline: true } });
  await prisma.user.update({ where: { id: provider.id }, data: { reminderActive: true, reminderChannel: Channel.EMAIL } });
  await googleConnectionRepository.upsertConnection(provider.id, { refreshToken: 'refresh-token', grantedScopes: [ REQUIRED_SCOPE ] });

  const [ start ] = await slotStarts(provider, 3);
  const session = sessionFor(provider.id, unique('meet@test.local'));
  const res = await portalPost(app, '/v1/portal/bookings', session, portalBookingBody({ ...provider, locationId: virtual.id }, start!));
  expect(res.status).toBe(201);
  mocks.send.mockClear();
  return { provider, session, id: res.body.data.appointment.id as string };
}

const run = (appointmentId: string, retryCount = 0) => provisionMeetWorker([ { data: { appointmentId }, retryCount } ]);
const appointment = (id: string) => prisma.appointment.findUniqueOrThrow({ where: { id }, include: { reminder: true } });
const notices = () => mocks.send.mock.calls.filter(([ q ]) => q === 'portal-booking-notify').map(([ , job ]) => job);

describe('provision-meet worker', () => {
  it('sets the Meet link: READY, the reminder re-rendered, the held confirmation queued, audited as JOB', async () => {
    const { id } = await pendingBooking();
    const since = new Date();

    await run(id);

    const appt = await appointment(id);
    expect(appt).toMatchObject({ meetingUrl: MEET, meetingStatus: MeetingStatus.READY });
    expect(appt.reminder?.body).toContain(MEET);
    expect(notices()).toEqual([ { appointmentId: id, kind: 'patient-confirmation' } ]);
    const audit = await prisma.auditLog.findFirst({ where: { entityId: id, eventTimeUtc: { gte: since }, affectedFields: { has: 'meetingStatus' } } });
    expect(audit?.source).toBe(ActionSource.JOB);
  });

  it('is idempotent: a re-run after the link is set does nothing', async () => {
    const { id } = await pendingBooking();
    await run(id);
    mocks.send.mockClear();
    await run(id);
    expect(mocks.createMeetingSpace).toHaveBeenCalledTimes(1);
    expect(notices()).toEqual([]);
  });

  it('skips an appointment cancelled (or deleted) while the link was pending', async () => {
    const { id, provider } = await pendingBooking();
    await appointmentService.setStatus(id, provider.id, AppointmentStatus.CANCELLED);
    await run(id);
    expect(mocks.createMeetingSpace).not.toHaveBeenCalled();
    expect((await appointment(id)).meetingStatus).toBe(MeetingStatus.PENDING);
  });

  it('does not use a link created after the appointment was cancelled meanwhile', async () => {
    const { id, provider } = await pendingBooking();
    mocks.createMeetingSpace.mockImplementation(async () => {
      await appointmentService.setStatus(id, provider.id, AppointmentStatus.CANCELLED);
      return { meetingUrl: MEET, spaceName: 'spaces/abc' };
    });
    await run(id);
    expect((await appointment(id)).meetingUrl).toBeNull();
    expect(notices()).toEqual([]);
  });

  it.each([ 'GOOGLE_TOKEN_REVOKED', 'GOOGLE_CONNECTION_NOT_FOUND', 'GOOGLE_SCOPE_MISSING', 'GOOGLE_CONFIG_MISSING' ])(
    'hands the link to the provider at once on %s, with the confirmation saying it will follow',
    async (code) => {
      const { id, session } = await pendingBooking();
      mocks.createMeetingSpace.mockRejectedValue(new GoogleOAuthError('no', code, 409));
      await run(id);

      expect((await appointment(id)).meetingStatus).toBe(MeetingStatus.NEEDS_LINK);
      expect(notices()).toEqual([ { appointmentId: id, kind: 'patient-confirmation' } ]);

      await deliverBookingNotification({ appointmentId: id, kind: 'patient-confirmation' });
      const [ , email ] = mocks.dispatch.mock.calls[ 0 ]!;
      expect(email).toMatchObject({ to: session.email });
      expect(email.body).toContain(MEETING_LINK_PENDING_LINE);
    },
  );

  it('retries a Google API error, and falls back to NEEDS_LINK on the final attempt', async () => {
    const { id } = await pendingBooking();
    mocks.createMeetingSpace.mockRejectedValue(new GoogleOAuthError('boom', 'GOOGLE_API_ERROR', 502));

    await expect(run(id, 0)).rejects.toThrow('boom');
    expect((await appointment(id)).meetingStatus).toBe(MeetingStatus.PENDING);
    expect(notices()).toEqual([]);

    await run(id, PROVISION_MEET_RETRY_LIMIT - 1);
    expect((await appointment(id)).meetingStatus).toBe(MeetingStatus.NEEDS_LINK);
    expect(notices()).toEqual([ { appointmentId: id, kind: 'patient-confirmation' } ]);
  });
});

describe('patient confirmation while the link is pending', () => {
  it('is held while PENDING and carries the link once READY', async () => {
    const { id, session } = await pendingBooking();
    await deliverBookingNotification({ appointmentId: id, kind: 'patient-confirmation' });
    expect(mocks.dispatch).not.toHaveBeenCalled();

    await run(id);
    await deliverBookingNotification({ appointmentId: id, kind: 'patient-confirmation' });
    const [ , email ] = mocks.dispatch.mock.calls[ 0 ]!;
    expect(email).toMatchObject({ to: session.email });
    expect(email.body).toContain(`Enlace de la videollamada: ${MEET}`);
    expect(email.body).not.toContain(MEETING_LINK_PENDING_LINE);
  });
});

describe('sweep-pending-meetings', () => {
  it('hands links PENDING for over 30 minutes to the provider and leaves recent ones', async () => {
    const stale = await pendingBooking();
    const fresh = await pendingBooking();
    await prisma.appointment.update({ where: { id: stale.id }, data: { createdAt: new Date(Date.now() - 31 * 60_000) } });

    await sweepPendingMeetingsWorker();

    expect((await appointment(stale.id)).meetingStatus).toBe(MeetingStatus.NEEDS_LINK);
    expect((await appointment(fresh.id)).meetingStatus).toBe(MeetingStatus.PENDING);
    expect(notices()).toEqual([ { appointmentId: stale.id, kind: 'patient-confirmation' } ]);
    const audit = await prisma.auditLog.findFirst({ where: { entityId: stale.id, affectedFields: { has: 'meetingStatus' } } });
    expect(audit?.source).toBe(ActionSource.JOB);
  });
});
