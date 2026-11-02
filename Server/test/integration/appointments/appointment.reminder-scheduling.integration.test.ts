import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ send: vi.fn(), dispatch: vi.fn() }));
vi.mock('../../../src/scheduler/pg-boss.js', () => ({ getBoss: () => ({ send: mocks.send }) }));
vi.mock('../../../src/scheduler/dispatch.js', () => ({ dispatchMessage: mocks.dispatch }));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { config } from '../../../src/utils/config/config.js';
import { appointmentService } from '../../../src/appointments/appointment.service.js';
import { sendReminderWorker } from '../../../src/scheduler/workers/send-reminder.js';
import { AppointmentStatus, Channel, ReminderMode, ReminderStatus } from '../../../generated/prisma/enums.js';
import { appointmentTimeRange, createTestAppointmentType, createTestLocation, createTestPatient, createTestUser } from '../helpers.js';

const scheduler = config.scheduler as { enabled: boolean };
const schedulerWas = scheduler.enabled;
afterAll(() => { scheduler.enabled = schedulerWas; });
beforeEach(() => {
  scheduler.enabled = true;
  mocks.send.mockReset().mockResolvedValue('job-1');
  mocks.dispatch.mockReset().mockResolvedValue({ success: true, messageSid: 'msg-1' });
});

async function setup() {
  const user = await createTestUser();
  const patient = await createTestPatient(user.id);
  const location = await createTestLocation(user.id);
  const type = await createTestAppointmentType(user.id);
  return { user, patient, location, type };
}

function createDto(ctx: Awaited<ReturnType<typeof setup>>, reminder: { sendMode: ReminderMode; sendAt?: string }) {
  const { start, end } = appointmentTimeRange(3 * 24 * 60, 60);
  return {
    startAt: start.toISOString(), endAt: end.toISOString(), price: 0, paid: false, status: AppointmentStatus.SCHEDULED,
    patientId: ctx.patient.id, locationId: ctx.location.id, typeId: ctx.type.id,
    reminder: { channel: Channel.EMAIL, to: ctx.patient.email!, status: ReminderStatus.PENDING, ...reminder },
  };
}

const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

describe('linked reminder scheduling', () => {
  it('enqueues a SCHEDULED reminder at its sendAt, in the same transaction', async () => {
    const ctx = await setup();
    const sendAt = inHours(48);
    const appt = await appointmentService.create(createDto(ctx, { sendMode: ReminderMode.SCHEDULED, sendAt }), ctx.user.id);

    expect(mocks.send).toHaveBeenCalledWith('send-reminder', { reminderId: appt.reminder!.id }, {
      db: expect.anything(),
      startAfter: new Date(sendAt),
    });
  });

  it('enqueues an IMMEDIATE reminder without a start time', async () => {
    const ctx = await setup();
    const appt = await appointmentService.create(createDto(ctx, { sendMode: ReminderMode.IMMEDIATE }), ctx.user.id);
    expect(mocks.send).toHaveBeenCalledWith('send-reminder', { reminderId: appt.reminder!.id }, { db: expect.anything() });
  });

  it('enqueues again when an update moves the reminder, and not for unrelated edits', async () => {
    const ctx = await setup();
    const appt = await appointmentService.create(createDto(ctx, { sendMode: ReminderMode.SCHEDULED, sendAt: inHours(48) }), ctx.user.id);
    mocks.send.mockClear();

    const reminder = { channel: Channel.EMAIL, to: ctx.patient.email!, sendMode: ReminderMode.SCHEDULED, status: ReminderStatus.PENDING };
    await appointmentService.update(appt.id, { notes: 'traer exámenes' }, ctx.user.id);
    await appointmentService.update(appt.id, { reminder: { ...reminder, sendAt: appt.reminder!.sendAt.toISOString() } }, ctx.user.id);
    expect(mocks.send).not.toHaveBeenCalled();

    const later = inHours(60);
    await appointmentService.update(appt.id, { reminder: { ...reminder, sendAt: later } }, ctx.user.id);
    expect(mocks.send).toHaveBeenCalledWith('send-reminder', { reminderId: appt.reminder!.id }, {
      db: expect.anything(),
      startAfter: new Date(later),
    });
  });

  it('does not enqueue without the scheduler', async () => {
    scheduler.enabled = false;
    const ctx = await setup();
    await appointmentService.create(createDto(ctx, { sendMode: ReminderMode.SCHEDULED, sendAt: inHours(48) }), ctx.user.id);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

describe('send-reminder worker', () => {
  async function scheduledReminder(sendAt: string) {
    const { user, patient } = await setup();
    return prisma.reminder.create({
      data: {
        userId: user.id, patientId: patient.id, channel: Channel.EMAIL, to: patient.email!, body: 'Hola', subject: 'Recordatorio',
        sendMode: ReminderMode.SCHEDULED, sendAt: new Date(sendAt), status: ReminderStatus.PENDING,
      },
    });
  }

  it('skips a stale job that fires before a later sendAt', async () => {
    const reminder = await scheduledReminder(inHours(2));
    await sendReminderWorker([ { data: { reminderId: reminder.id } } ]);
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect((await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } })).status).toBe(ReminderStatus.PENDING);
  });

  it('sends a reminder whose sendAt has come', async () => {
    const reminder = await scheduledReminder(new Date(Date.now() - 1000).toISOString());
    await sendReminderWorker([ { data: { reminderId: reminder.id } } ]);
    expect(mocks.dispatch).toHaveBeenCalledWith(Channel.EMAIL, expect.objectContaining({ to: reminder.to }));
  });
});
