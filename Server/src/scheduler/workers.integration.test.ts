import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the Twilio status poller used by the track-delivery worker.
vi.mock('../twilio/twilioClient.js', () => ({
  getMessageStatus: vi.fn(),
}));

// Mock the dispatch boundary used by the daily-reminder worker.
const dispatchMock = vi.fn().mockResolvedValue({ success: true, messageSid: 'SMdaily', channel: 'WHATSAPP' });
vi.mock('../scheduler/dispatch.js', () => ({
  dispatchMessage: (...args: unknown[]) => dispatchMock(...args),
}));

import { prisma } from '../prisma/prismaClient.js';
import { trackDeliveryWorker } from './workers/trackDelivery.js';
import { dailyReminderWorker } from './workers/dailyReminder.js';
import { completeAppointmentsWorker } from './workers/completeAppointments.js';
import { getMessageStatus } from '../twilio/twilioClient.js';
import { getTomorrowUTCRange, getLocalTimeParts } from '../utils/timeUtils.js';
import { config } from '../utils/config.js';
import { createTestUser, createTestPatient, createTestLocation, createTestAppointmentType } from '../../test/integration/helpers.js';
import {
  AppointmentStatus,
  ReminderStatus,
  Channel,
} from '../../generated/prisma/client.ts';

let userId: string;
let patientId: string;

beforeEach(async () => {
  const user = await createTestUser();
  userId = user.id;
  const patient = await createTestPatient(userId);
  patientId = patient.id;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('completeAppointmentsWorker (integration)', () => {
  it('marks past CONFIRMED and SCHEDULED appointments as COMPLETED', async () => {
    const { start } = appointmentTimeRange(-120, 60); // ended 60 min ago
    const location = await createTestLocation(userId);
    const type = await createTestAppointmentType(userId);

    const confirmed = await prisma.appointment.create({
      data: {
        startAt: start,
        endAt: new Date(start.getTime() + 60 * 60_000),
        price: 50000,
        patientId,
        userId,
        locationId: location.id,
        typeId: type.id,
        status: AppointmentStatus.CONFIRMED,
      },
    });
    const scheduled = await prisma.appointment.create({
      data: {
        startAt: start,
        endAt: new Date(start.getTime() + 60 * 60_000),
        price: 50000,
        patientId,
        userId,
        status: AppointmentStatus.SCHEDULED,
      },
    });

    await completeAppointmentsWorker();

    const c = await prisma.appointment.findUnique({ where: { id: confirmed.id } });
    const s = await prisma.appointment.findUnique({ where: { id: scheduled.id } });
    expect(c!.status).toBe(AppointmentStatus.COMPLETED);
    expect(c!.completedAt).toBeTruthy();
    expect(s!.status).toBe(AppointmentStatus.COMPLETED);
    expect(s!.completedAt).toBeTruthy();
  });

  it('leaves future appointments untouched', async () => {
    const { start, end } = appointmentTimeRange(120, 60); // starts in the future
    const future = await prisma.appointment.create({
      data: {
        startAt: start,
        endAt: end,
        price: 50000,
        patientId,
        userId,
        status: AppointmentStatus.CONFIRMED,
      },
    });

    await completeAppointmentsWorker();

    const f = await prisma.appointment.findUnique({ where: { id: future.id } });
    expect(f!.status).toBe(AppointmentStatus.CONFIRMED);
    expect(f!.completedAt).toBeNull();
  });
});

describe('trackDeliveryWorker (integration)', () => {
  it('fails stale QUEUED reminders whose tracking timed out', async () => {
    const stale = await prisma.reminder.create({
      data: {
        channel: Channel.WHATSAPP,
        to: '+10000000000',
        sendMode: 'IMMEDIATE',
        sendAt: new Date(Date.now() - 40 * 60 * 1000),
        status: ReminderStatus.QUEUED,
        patientId,
        userId,
        messageId: 'SMstale',
        updatedAt: new Date(Date.now() - 40 * 60 * 1000),
      },
    });

    await trackDeliveryWorker();

    const r = await prisma.reminder.findUnique({ where: { id: stale.id } });
    expect(r!.status).toBe(ReminderStatus.FAILED);
    expect(r!.error).toBeTruthy();
  });

  it('polls Twilio and marks a delivered reminder SENT', async () => {
    (getMessageStatus as any).mockResolvedValueOnce({ sid: 'SMpoll', status: 'delivered' });

    const queued = await prisma.reminder.create({
      data: {
        channel: Channel.WHATSAPP,
        to: '+10000000000',
        sendMode: 'IMMEDIATE',
        sendAt: new Date(Date.now() - 1000),
        status: ReminderStatus.QUEUED,
        patientId,
        userId,
        messageId: 'SMpoll',
      },
    });

    await trackDeliveryWorker();

    const r = await prisma.reminder.findUnique({ where: { id: queued.id } });
    expect(r!.status).toBe(ReminderStatus.SENT);
    expect(r!.error).toBeNull();
  });

  it('polls Twilio and marks a failed reminder FAILED', async () => {
    (getMessageStatus as any).mockResolvedValueOnce({ sid: 'SMpoll2', status: 'failed' });

    const queued = await prisma.reminder.create({
      data: {
        channel: Channel.WHATSAPP,
        to: '+10000000000',
        sendMode: 'IMMEDIATE',
        sendAt: new Date(Date.now() - 1000),
        status: ReminderStatus.QUEUED,
        patientId,
        userId,
        messageId: 'SMpoll2',
      },
    });

    await trackDeliveryWorker();

    const r = await prisma.reminder.findUnique({ where: { id: queued.id } });
    expect(r!.status).toBe(ReminderStatus.FAILED);
    expect(r!.error).toBeTruthy();
  });
});

describe('dailyReminderWorker (integration)', () => {
  const tz = 'America/Bogota';
  let savedHour: number;

  beforeEach(() => {
    // Pin the scheduler hour to the user's current local hour so the worker runs
    // deterministically regardless of when the test executes.
    savedHour = (config as any).scheduler.dailyReminderHour;
    (config as any).scheduler.dailyReminderHour = getLocalTimeParts(tz).hour;
  });

  afterEach(() => {
    (config as any).scheduler.dailyReminderHour = savedHour;
  });

  it('sends a daily reminder for tomorrow appointments and records the send date', async () => {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        reminderActive: true,
        reminderChannel: Channel.WHATSAPP,
        whatsappNumber: '+57300123456',
        timezone: tz,
        lastDailyReminderDate: null,
      },
    });

    const { start, end } = tomorrowRange(tz);
    const location = await createTestLocation(userId);
    const type = await createTestAppointmentType(userId);
    await prisma.appointment.create({
      data: {
        startAt: start,
        endAt: end,
        price: 50000,
        patientId,
        userId,
        locationId: location.id,
        typeId: type.id,
        status: AppointmentStatus.CONFIRMED,
      },
    });

    await dailyReminderWorker();

    expect(dispatchMock).toHaveBeenCalledTimes(1);
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated!.lastDailyReminderDate).toBeTruthy();
  });

  it('skips users with no appointments tomorrow', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: {
        reminderActive: true,
        reminderChannel: Channel.WHATSAPP,
        whatsappNumber: '+57300123456',
        timezone: tz,
        lastDailyReminderDate: null,
      },
    });

    // No appointments created for tomorrow.
    await dailyReminderWorker();

    expect(dispatchMock).not.toHaveBeenCalled();
    const updated = await prisma.user.findUnique({ where: { id: userId } });
    expect(updated!.lastDailyReminderDate).toBeNull();
  });
});

// Helpers -----------------------------------------------------------------

function appointmentTimeRange(offsetMinutes: number, durationMinutes: number) {
  const start = new Date(Date.now() + offsetMinutes * 60_000);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start, end };
}

function tomorrowRange(timezone: string) {
  const { start, end } = getTomorrowUTCRange(timezone);
  return { start, end };
}
