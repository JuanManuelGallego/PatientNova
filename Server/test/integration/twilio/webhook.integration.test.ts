import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Twilio SDK boundary so no real network calls are made.
vi.mock('../../../src/twilio/client.js', () => ({
  sendWhatsApp: vi.fn().mockResolvedValue({ success: true, messageSid: 'SMmock', channel: 'WHATSAPP', to: '+10000000000' }),
  sendWhatsAppFreeForm: vi.fn().mockResolvedValue({ success: true, messageSid: 'SMmock', channel: 'WHATSAPP', to: '+10000000000' }),
  sendSms: vi.fn().mockResolvedValue({ success: true, messageSid: 'SMmock', channel: 'SMS', to: '+10000000000' }),
  getMessageStatus: vi.fn().mockResolvedValue({ sid: 'SMmock', status: 'delivered' }),
}));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { sendWhatsAppFreeForm } from '../../../src/twilio/client.js';
import { twilioWebhookService } from '../../../src/twilio/webhook.service.js';
import { appointmentRepository } from '../../../src/appointments/appointment.repository.js';
import { createTestUser, createTestPatient, createTestLocation, createTestAppointmentType, appointmentTimeRange } from '../helpers.js';
import { AppointmentStatus, CancelledBy, ReminderStatus, Channel } from '../../../generated/prisma/client.ts';

let userId: string;
let patientId: string;
let apptId: string;
const PHONE = '+57300123456';

beforeEach(async () => {
  const user = await createTestUser();
  userId = user.id;
  const patient = await createTestPatient(userId);
  patientId = patient.id;

  const loc = await createTestLocation(userId);
  const type = await createTestAppointmentType(userId);
  const { start, end } = appointmentTimeRange(120, 30);
  const appt = await appointmentRepository.create(
    {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      price: 0,
      paid: false,
      status: AppointmentStatus.SCHEDULED,
      patientId,
      locationId: loc.id,
      typeId: type.id,
    },
    userId,
  );
  apptId = appt.id;

  // Active WhatsApp reminder linked to the appointment, sent in the past
  await prisma.reminder.create({
    data: {
      channel: Channel.WHATSAPP,
      to: PHONE,
      sendMode: 'IMMEDIATE',
      sendAt: new Date(Date.now() - 60_000),
      sentAt: new Date(Date.now() - 60_000),
      status: ReminderStatus.SENT,
      patientId,
      userId,
      appointmentId: apptId,
    },
  });
});

describe('twilioWebhookService (integration)', () => {
  it('confirms a scheduled appointment via a confirm button payload', async () => {
    const result = await twilioWebhookService.processWhatsAppReply({ from: `whatsapp:${PHONE}`, buttonPayload: 'confirm' });
    expect(result.success).toBe(true);

    const appt = await prisma.appointment.findUnique({ where: { id: apptId } });
    expect(appt!.status).toBe(AppointmentStatus.CONFIRMED);
    expect(appt!.confirmedAt).toBeInstanceOf(Date);
  });

  it('cancels a scheduled appointment via a cancel button payload', async () => {
    const result = await twilioWebhookService.processWhatsAppReply({ from: `whatsapp:${PHONE}`, buttonPayload: 'cancel' });
    expect(result.success).toBe(true);

    const appt = await prisma.appointment.findUnique({ where: { id: apptId } });
    expect(appt!.status).toBe(AppointmentStatus.CANCELLED);
    expect(appt!.cancelledAt).toBeInstanceOf(Date);
  });

  it('records the patient as the canceller and audits in the same transaction', async () => {
    await twilioWebhookService.processWhatsAppReply({ from: `whatsapp:${PHONE}`, buttonPayload: 'cancel' });

    const appt = await prisma.appointment.findUnique({ where: { id: apptId } });
    expect(appt!.cancelledBy).toBe(CancelledBy.PATIENT);
    const audits = await prisma.auditLog.count({ where: { entityId: apptId } });
    expect(audits).toBe(1);
  });

  it.each([
    [ 'cancelled', { status: AppointmentStatus.CANCELLED } ],
    [ 'completed', { status: AppointmentStatus.COMPLETED } ],
    [ 'deleted', { isDeleted: true } ],
  ])('a stale confirm does not touch a %s appointment', async (_label, data) => {
    await prisma.appointment.update({ where: { id: apptId }, data });
    const before = await prisma.appointment.findUnique({ where: { id: apptId } });

    const result = await twilioWebhookService.processWhatsAppReply({ from: `whatsapp:${PHONE}`, buttonPayload: 'confirm' });

    expect(result).toEqual({ success: false, message: 'Appointment not modifiable' });
    const after = await prisma.appointment.findUnique({ where: { id: apptId } });
    expect(after!.status).toBe(before!.status);
    expect(after!.confirmedAt).toBeNull();
  });

  it('a stale cancel does not touch a completed, paid appointment', async () => {
    await prisma.appointment.update({ where: { id: apptId }, data: { status: AppointmentStatus.COMPLETED, paid: true } });

    const result = await twilioWebhookService.processWhatsAppReply({ from: `whatsapp:${PHONE}`, buttonPayload: 'cancel' });

    expect(result.success).toBe(false);
    const appt = await prisma.appointment.findUnique({ where: { id: apptId } });
    expect(appt!.status).toBe(AppointmentStatus.COMPLETED);
    expect(appt!.paid).toBe(true);
  });

  it('does not reactivate a cancelled appointment whose slot was rebooked', async () => {
    const original = await prisma.appointment.update({ where: { id: apptId }, data: { status: AppointmentStatus.CANCELLED } });
    await appointmentRepository.create(
      {
        startAt: original.startAt.toISOString(),
        endAt: original.endAt.toISOString(),
        price: 0,
        paid: false,
        status: AppointmentStatus.SCHEDULED,
        patientId,
        locationId: original.locationId!,
        typeId: original.typeId!,
      },
      userId,
    );

    const result = await twilioWebhookService.processWhatsAppReply({ from: `whatsapp:${PHONE}`, buttonPayload: 'confirm' });

    expect(result.message).toBe('Appointment not modifiable');
    const appt = await prisma.appointment.findUnique({ where: { id: apptId } });
    expect(appt!.status).toBe(AppointmentStatus.CANCELLED);
  });

  it('ignores an unknown intent', async () => {
    const result = await twilioWebhookService.processWhatsAppReply({ from: `whatsapp:${PHONE}`, buttonPayload: 'hello' });
    expect(result.success).toBe(false);

    const appt = await prisma.appointment.findUnique({ where: { id: apptId } });
    expect(appt!.status).toBe(AppointmentStatus.SCHEDULED);
  });

  it('ignores a payload with no matching active reminder', async () => {
    const result = await twilioWebhookService.processWhatsAppReply({ from: 'whatsapp:+59999999999', buttonPayload: 'confirm' });
    expect(result.success).toBe(false);

    const appt = await prisma.appointment.findUnique({ where: { id: apptId } });
    expect(appt!.status).toBe(AppointmentStatus.SCHEDULED);
  });

  describe('rebooking reply after a cancellation', () => {
    beforeEach(() => {
      vi.mocked(sendWhatsAppFreeForm).mockClear();
    });

    async function makeBookable(slug: string, extra: Record<string, unknown> = {}) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          displayName: 'Dra. Ana', legalName: 'Consultorio Prueba S.A.S.', privacyContact: 'privacidad@test.local',
          contactHours: 'Lunes a viernes, 8:00 a 17:00', publicPhone: '+573001234567',
          bookingSlug: slug, bookingEnabled: true, ...extra,
        },
      });
      await prisma.availabilityRule.create({ data: { userId, weekday: 1, startMinute: 540, endMinute: 720 } });
      await prisma.appointmentType.updateMany({ where: { userId }, data: { bookableOnline: true } });
      const location = await createTestLocation(userId);
      await prisma.appointmentLocation.update({ where: { id: location.id }, data: { bookableOnline: true } });
    }

    async function cancelAndReadReply(): Promise<string> {
      const result = await twilioWebhookService.processWhatsAppReply({ from: `whatsapp:${PHONE}`, buttonPayload: 'cancel' });
      expect(result.success).toBe(true);
      const calls = vi.mocked(sendWhatsAppFreeForm).mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0]![0]).toBe(PHONE);
      return calls[0]![1];
    }

    async function expectNoPatientData(reply: string) {
      const type = await prisma.appointmentType.findFirstOrThrow({ where: { userId } });
      expect(reply).not.toContain('Maria');
      expect(reply).not.toContain('Garcia');
      expect(reply).not.toContain(type.name);
    }

    it('links the live booking page', async () => {
      await makeBookable('dra-ana-live');

      const reply = await cancelAndReadReply();

      expect(reply).toMatch(/^❌ Tu cita con Dra\. Ana quedó cancelada\. Si quieres, puedes agendar una nueva aquí: .+\/book\/dra-ana-live$/);
      await expectNoPatientData(reply);
    });

    it('links the public WhatsApp when booking is paused', async () => {
      await makeBookable('dra-ana-paused', { bookingEnabled: false, publicWhatsapp: '+57 300 999 8877' });

      const reply = await cancelAndReadReply();

      expect(reply).toBe('❌ Tu cita con Dra. Ana quedó cancelada. Para agendar una nueva, comunícate con Dra. Ana: https://wa.me/573009998877');
      expect(reply).not.toContain('/book/');
      await expectNoPatientData(reply);
    });

    it('sends the generic reply when the provider has no booking page or public contact', async () => {
      const reply = await cancelAndReadReply();

      expect(reply).toBe('❌ Tu cita ha sido cancelada. Para agendar una nueva, por favor comunícate con tu profesional de la salud.');
    });
  });
});
