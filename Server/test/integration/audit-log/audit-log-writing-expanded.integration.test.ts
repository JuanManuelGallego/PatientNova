import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../src/scheduler/reminder-job-manager.js', () => ({
  reminderJobManager: {
    enqueue: vi.fn().mockResolvedValue(undefined),
    enqueueImmediate: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    reschedule: vi.fn().mockResolvedValue(undefined),
    hasQueuedJob: vi.fn().mockResolvedValue(false),
  },
}));

vi.mock('../../../src/twilio/client.js', () => ({
  sendWhatsApp: vi.fn().mockResolvedValue({}),
  sendWhatsAppFreeForm: vi.fn().mockResolvedValue({}),
  sendSms: vi.fn().mockResolvedValue({}),
}));

import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { appointmentService } from '../../../src/appointments/appointment.service.js';
import { reminderService } from '../../../src/reminders/reminder.service.js';
import { userService } from '../../../src/users/user.service.js';
import { authService } from '../../../src/auth/auth.service.js';
import { consentDocumentService } from '../../../src/consent-documents/consent-document.service.js';
import { patientService } from '../../../src/patients/patient.service.js';
import { createTestUser, createTestPatient, createTestLocation, createTestAppointmentType, appointmentTimeRange, unique } from '../helpers.js';
import { runInAuditContext } from '../../../src/audit-log/audit-log-context.js';
import { AppointmentStatus, Channel, ReminderMode, ReminderStatus } from '../../../generated/prisma/client.ts';

let userId: string;
let patientId: string;
let locationId: string;
let typeId: string;

beforeEach(async () => {
  const user = await createTestUser();
  userId = user.id;
  const patient = await createTestPatient(userId);
  patientId = patient.id;
  const loc = await createTestLocation(userId);
  locationId = loc.id;
  const type = await createTestAppointmentType(userId);
  typeId = type.id;
});

function withAuditContext<T>(fn: () => T): T {
  return runInAuditContext({
    actorId: userId,
    actorDisplayName: 'test@test.com',
    ipAddress: '127.0.0.1',
    userId,
  }, fn);
}

async function getLatestAuditLog(entityType: string, entityId: string) {
  return prisma.auditLog.findFirst({
    where: { entityType: entityType as any, entityId },
    orderBy: { eventTimeUtc: 'desc' },
  });
}

async function getAuditLogsForEntity(entityType: string, entityId: string) {
  return prisma.auditLog.findMany({
    where: { entityType: entityType as any, entityId },
    orderBy: { eventTimeUtc: 'desc' },
  });
}

function baseApptDto(overrides: Record<string, unknown> = {}) {
  const { start, end } = appointmentTimeRange(120, 30);
  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    price: 100,
    paid: false,
    status: AppointmentStatus.SCHEDULED,
    patientId,
    locationId,
    typeId,
    ...overrides,
  };
}

describe('Audit writing: appointments (integration)', () => {
  it('creates an audit log on appointment create', async () => {
    const appt = await withAuditContext(() => appointmentService.create(baseApptDto(), userId));

    const log = await getLatestAuditLog('APPOINTMENT', appt.id);
    expect(log).toBeTruthy();
    expect(log!.actionType).toBe('CREATE');
    expect(log!.actorId).toBe(userId);
    expect(log!.source).toBe('API');
    expect(log!.affectedFields).toContain('patientId');
    expect(log!.fieldsAfter).toMatchObject({ patientId, locationId, typeId });
  });

  it('creates an audit log on appointment update with diff', async () => {
    const appt = await withAuditContext(() => appointmentService.create(baseApptDto(), userId));

    await withAuditContext(() => appointmentService.update(appt.id, { notes: 'Updated notes' }, userId));

    const logs = await getAuditLogsForEntity('APPOINTMENT', appt.id);
    const updateLog = logs.find(l => l.actionType === 'UPDATE');
    expect(updateLog).toBeTruthy();
    expect(updateLog!.affectedFields).toContain('notes');
    expect(updateLog!.fieldsBefore).toMatchObject({ notes: null });
    expect(updateLog!.fieldsAfter).toMatchObject({ notes: 'Updated notes' });
  });

  it('creates an audit log on appointment setStatus', async () => {
    const appt = await withAuditContext(() => appointmentService.create(baseApptDto(), userId));

    await withAuditContext(() => appointmentService.setStatus(appt.id, userId, AppointmentStatus.CONFIRMED));

    const logs = await getAuditLogsForEntity('APPOINTMENT', appt.id);
    const statusLog = logs.find(l => l.actionType === 'UPDATE' && l.affectedFields.includes('status'));
    expect(statusLog).toBeTruthy();
    expect(statusLog!.affectedFields).toEqual(['status']);
    expect(statusLog!.fieldsBefore).toMatchObject({ status: AppointmentStatus.SCHEDULED });
    expect(statusLog!.fieldsAfter).toMatchObject({ status: AppointmentStatus.CONFIRMED });
  });

  it('creates an audit log on appointment markPaid', async () => {
    const appt = await withAuditContext(() => appointmentService.create(baseApptDto(), userId));

    await withAuditContext(() => appointmentService.markPaid(appt.id, userId));

    const logs = await getAuditLogsForEntity('APPOINTMENT', appt.id);
    const paidLog = logs.find(l => l.actionType === 'UPDATE' && l.affectedFields.includes('paid'));
    expect(paidLog).toBeTruthy();
    expect(paidLog!.affectedFields).toEqual(['paid']);
    expect(paidLog!.fieldsBefore).toMatchObject({ paid: false });
    expect(paidLog!.fieldsAfter).toMatchObject({ paid: true });
  });

  it('creates an audit log on appointment delete', async () => {
    const appt = await withAuditContext(() => appointmentService.create(baseApptDto(), userId));

    await withAuditContext(() => appointmentService.delete(appt.id, userId));

    const logs = await getAuditLogsForEntity('APPOINTMENT', appt.id);
    const deleteLog = logs.find(l => l.actionType === 'DELETE');
    expect(deleteLog).toBeTruthy();
    expect(deleteLog!.fieldsBefore).toMatchObject({ isDeleted: false });
  });

  it('creates an audit log on appointment restore', async () => {
    const appt = await withAuditContext(() => appointmentService.create(baseApptDto(), userId));
    await withAuditContext(() => appointmentService.delete(appt.id, userId));
    await withAuditContext(() => appointmentService.restore(appt.id, userId));

    const logs = await getAuditLogsForEntity('APPOINTMENT', appt.id);
    const restoreLog = logs.find(l => l.actionType === 'RESTORE');
    expect(restoreLog).toBeTruthy();
    expect(restoreLog!.fieldsAfter).toMatchObject({ isDeleted: false });
  });
});

describe('Audit writing: reminders (integration)', () => {
  it('creates an audit log on reminder create', async () => {
    const future = new Date(Date.now() + 2 * 60 * 60_000);
    const reminder = await withAuditContext(() => reminderService.create({
      channel: Channel.WHATSAPP,
      to: '+573001234567',
      sendMode: ReminderMode.SCHEDULED,
      sendAt: future,
      patientId,
      status: ReminderStatus.PENDING,
    }, userId, false));

    const log = await getLatestAuditLog('REMINDER', reminder.id);
    expect(log).toBeTruthy();
    expect(log!.actionType).toBe('CREATE');
    expect(log!.actorId).toBe(userId);
    expect(log!.affectedFields).toContain('channel');
    expect(log!.fieldsAfter).toMatchObject({ channel: 'WHATSAPP', patientId });
  });

  it('creates an audit log on reminder update with diff', async () => {
    const future = new Date(Date.now() + 2 * 60 * 60_000);
    const future2 = new Date(Date.now() + 3 * 60 * 60_000);
    const reminder = await withAuditContext(() => reminderService.create({
      channel: Channel.WHATSAPP,
      to: '+573001234567',
      sendMode: ReminderMode.SCHEDULED,
      sendAt: future,
      patientId,
      status: ReminderStatus.PENDING,
    }, userId, false));

    await withAuditContext(() => reminderService.update(reminder.id, {
      sendAt: future2,
    }, userId));

    const logs = await getAuditLogsForEntity('REMINDER', reminder.id);
    const updateLog = logs.find(l => l.actionType === 'UPDATE' && l.entityType === 'REMINDER');
    expect(updateLog).toBeTruthy();
    expect(updateLog!.affectedFields).toContain('sendAt');
  });

  it('creates an audit log on reminder cancel', async () => {
    const future = new Date(Date.now() + 2 * 60 * 60_000);
    const reminder = await withAuditContext(() => reminderService.create({
      channel: Channel.WHATSAPP,
      to: '+573001234567',
      sendMode: ReminderMode.SCHEDULED,
      sendAt: future,
      patientId,
      status: ReminderStatus.PENDING,
    }, userId, false));

    await withAuditContext(() => reminderService.cancel(reminder.id, userId));

    const logs = await getAuditLogsForEntity('REMINDER', reminder.id);
    const cancelLog = logs.find(l => l.actionType === 'UPDATE' && l.affectedFields.includes('status'));
    expect(cancelLog).toBeTruthy();
    expect(cancelLog!.affectedFields).toEqual(['status']);
    expect(cancelLog!.fieldsAfter).toMatchObject({ status: ReminderStatus.CANCELLED });
  });

  it('creates an audit log on reminder softDelete', async () => {
    const future = new Date(Date.now() + 2 * 60 * 60_000);
    const reminder = await withAuditContext(() => reminderService.create({
      channel: Channel.WHATSAPP,
      to: '+573001234567',
      sendMode: ReminderMode.SCHEDULED,
      sendAt: future,
      patientId,
      status: ReminderStatus.PENDING,
    }, userId, false));

    await withAuditContext(() => reminderService.softDelete(reminder.id, userId));

    const logs = await getAuditLogsForEntity('REMINDER', reminder.id);
    const deleteLog = logs.find(l => l.actionType === 'DELETE');
    expect(deleteLog).toBeTruthy();
    expect(deleteLog!.fieldsBefore).toMatchObject({ isDeleted: false });
  });

  it('creates an audit log on reminder restore', async () => {
    const future = new Date(Date.now() + 2 * 60 * 60_000);
    const reminder = await withAuditContext(() => reminderService.create({
      channel: Channel.WHATSAPP,
      to: '+573001234567',
      sendMode: ReminderMode.SCHEDULED,
      sendAt: future,
      patientId,
      status: ReminderStatus.PENDING,
    }, userId, false));

    await withAuditContext(() => reminderService.softDelete(reminder.id, userId));
    await withAuditContext(() => reminderService.restore(reminder.id, userId));

    const logs = await getAuditLogsForEntity('REMINDER', reminder.id);
    const restoreLog = logs.find(l => l.actionType === 'RESTORE');
    expect(restoreLog).toBeTruthy();
    expect(restoreLog!.fieldsAfter).toMatchObject({ isDeleted: false });
  });

  it('creates an audit log on reminder retry', async () => {
    const future = new Date(Date.now() + 2 * 60 * 60_000);
    const reminder = await withAuditContext(() => reminderService.create({
      channel: Channel.WHATSAPP,
      to: '+573001234567',
      sendMode: ReminderMode.SCHEDULED,
      sendAt: future,
      patientId,
      status: ReminderStatus.PENDING,
    }, userId, false));

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: ReminderStatus.FAILED },
    });

    await withAuditContext(() => reminderService.retry(reminder.id, userId));

    const logs = await getAuditLogsForEntity('REMINDER', reminder.id);
    const retryLog = logs.find(l => l.actionType === 'UPDATE' && l.affectedFields.includes('retryCount'));
    expect(retryLog).toBeTruthy();
    expect(retryLog!.affectedFields).toEqual(['status', 'retryCount']);
    expect(retryLog!.fieldsBefore).toMatchObject({ status: ReminderStatus.FAILED });
    expect(retryLog!.fieldsAfter).toMatchObject({ status: ReminderStatus.PENDING });
  });
});

describe('Audit writing: users (integration)', () => {
  it('creates an audit log on user create', async () => {
    const user = await withAuditContext(() => userService.create({
      email: unique('audit-user@test.local'),
      password: 'Password123!',
      role: 'ADMIN',
      status: 'ACTIVE',
      firstName: 'Audit',
      lastName: 'User',
    }));

    const log = await getLatestAuditLog('USER', user.id);
    expect(log).toBeTruthy();
    expect(log!.actionType).toBe('CREATE');
    expect(log!.actorId).toBe(userId);
    expect(log!.fieldsAfter).toMatchObject({ email: user.email, firstName: 'Audit', lastName: 'User' });
  });

  it('creates an audit log on user update with diff', async () => {
    const user = await withAuditContext(() => userService.create({
      email: unique('audit-user@test.local'),
      password: 'Password123!',
      role: 'ADMIN',
      status: 'ACTIVE',
      firstName: 'Original',
      lastName: 'Name',
    }));

    await withAuditContext(() => userService.update(user.id, { firstName: 'Changed' }));

    const logs = await getAuditLogsForEntity('USER', user.id);
    const updateLog = logs.find(l => l.actionType === 'UPDATE');
    expect(updateLog).toBeTruthy();
    expect(updateLog!.affectedFields).toContain('firstName');
    expect(updateLog!.fieldsBefore).toMatchObject({ firstName: 'Original' });
    expect(updateLog!.fieldsAfter).toMatchObject({ firstName: 'Changed' });
  });

  it('creates an audit log on user delete', async () => {
    const user = await withAuditContext(() => userService.create({
      email: unique('audit-user@test.local'),
      password: 'Password123!',
      role: 'ADMIN',
      status: 'ACTIVE',
      firstName: 'Delete',
      lastName: 'Me',
    }));

    await withAuditContext(() => userService.delete(user.id));

    const logs = await getAuditLogsForEntity('USER', user.id);
    const deleteLog = logs.find(l => l.actionType === 'DELETE');
    expect(deleteLog).toBeTruthy();
    expect(deleteLog!.fieldsBefore).toMatchObject({ email: user.email, firstName: 'Delete', lastName: 'Me' });
  });

  it('creates an audit log on user restore', async () => {
    const user = await withAuditContext(() => userService.create({
      email: unique('audit-user@test.local'),
      password: 'Password123!',
      role: 'ADMIN',
      status: 'ACTIVE',
      firstName: 'Restore',
      lastName: 'Me',
    }));

    await withAuditContext(() => userService.delete(user.id));
    await withAuditContext(() => userService.restore(user.id));

    const logs = await getAuditLogsForEntity('USER', user.id);
    const restoreLog = logs.find(l => l.actionType === 'RESTORE');
    expect(restoreLog).toBeTruthy();
    expect(restoreLog!.fieldsAfter).toMatchObject({ email: user.email, firstName: 'Restore' });
  });
});

describe('Audit writing: auth (integration)', () => {
  it('creates an audit log on successful login', async () => {
    const password = 'Password123!';
    const user = await createTestUser({ password });

    await withAuditContext(() => authService.login(user.email, password, '10.0.0.1'));

    const log = await getLatestAuditLog('USER', user.id);
    expect(log).toBeTruthy();
    expect(log!.actionType).toBe('UPDATE');
    expect(log!.description).toContain('inició sesión');
    expect(log!.affectedFields).toContain('lastLoginAt');
    expect(log!.fieldsAfter).toMatchObject({ lastLoginIp: '10.0.0.1' });
  });

  it('creates an audit log on logout', async () => {
    const user = await createTestUser();

    await withAuditContext(() => authService.logout(user.id));

    const log = await getLatestAuditLog('USER', user.id);
    expect(log).toBeTruthy();
    expect(log!.actionType).toBe('UPDATE');
    expect(log!.description).toContain('cerró sesión');
    expect(log!.affectedFields).toEqual(['refreshTokenVersion']);
  });

  it('creates an audit log on password change', async () => {
    const currentPassword = 'Password123!';
    const user = await createTestUser({ password: currentPassword });

    await withAuditContext(() => authService.changePassword(user.id, currentPassword, 'NewPassword456!'));

    const log = await getLatestAuditLog('USER', user.id);
    expect(log).toBeTruthy();
    expect(log!.actionType).toBe('UPDATE');
    expect(log!.description).toContain('cambió contraseña');
    expect(log!.affectedFields).toEqual(['passwordHash']);
  });
});

describe('Audit writing: consent documents (integration)', () => {
  it('creates an audit log on consent document create', async () => {
    await withAuditContext(() => consentDocumentService.create({
      name: 'Privacy Policy',
      content: 'base64content==',
      mimeType: 'application/pdf',
    }, userId));

    const log = await getLatestAuditLog('CONSENT_DOCUMENT', userId);
    expect(log).toBeTruthy();
    expect(log!.actionType).toBe('CREATE');
    expect(log!.actorId).toBe(userId);
    expect(log!.affectedFields).toContain('name');
  });

  it('creates an audit log on consent document update', async () => {
    await withAuditContext(() => consentDocumentService.create({
      name: 'Privacy Policy',
      content: 'base64content==',
      mimeType: 'application/pdf',
    }, userId));

    await withAuditContext(() => consentDocumentService.update(userId, {
      name: 'Updated Policy',
    }));

    const logs = await getAuditLogsForEntity('CONSENT_DOCUMENT', userId);
    const updateLog = logs.find(l => l.actionType === 'UPDATE');
    expect(updateLog).toBeTruthy();
    expect(updateLog!.affectedFields).toContain('name');
  });

  it('creates an audit log on consent document delete', async () => {
    await withAuditContext(() => consentDocumentService.create({
      name: 'Privacy Policy',
      content: 'base64content==',
      mimeType: 'application/pdf',
    }, userId));

    await withAuditContext(() => consentDocumentService.delete(userId));

    const logs = await getAuditLogsForEntity('CONSENT_DOCUMENT', userId);
    const deleteLog = logs.find(l => l.actionType === 'DELETE');
    expect(deleteLog).toBeTruthy();
    expect(deleteLog!.description).toContain('eliminado');
  });
});

describe('Audit writing: twilio webhook (integration)', () => {
  it('creates an audit log on appointment confirm via webhook', async () => {
    const appt = await withAuditContext(() => appointmentService.create(baseApptDto(), userId));

    const reminder = await prisma.reminder.create({
      data: {
        channel: Channel.WHATSAPP,
        to: '+573001234567',
        sendMode: ReminderMode.IMMEDIATE,
        sendAt: new Date(),
        status: ReminderStatus.SENT,
        patientId,
        userId,
        appointmentId: appt.id,
      },
    });

    const { TwilioWebhookService } = await import('../../../src/twilio/webhook.service.js');
    const svc = new TwilioWebhookService();
    await svc.confirmAppointment(reminder as any, '+573001234567');

    const log = await getLatestAuditLog('APPOINTMENT', appt.id);
    expect(log).toBeTruthy();
    expect(log!.actionType).toBe('UPDATE');
    expect(log!.description).toContain('confirmada via respuesta rápida de WhatsApp');
    expect(log!.affectedFields).toEqual(['status']);
    expect(log!.fieldsAfter).toMatchObject({ status: AppointmentStatus.CONFIRMED });
  });

  it('creates an audit log on appointment cancel via webhook', async () => {
    const appt = await withAuditContext(() => appointmentService.create(baseApptDto(), userId));

    const reminder = await prisma.reminder.create({
      data: {
        channel: Channel.WHATSAPP,
        to: '+573001234567',
        sendMode: ReminderMode.IMMEDIATE,
        sendAt: new Date(),
        status: ReminderStatus.SENT,
        patientId,
        userId,
        appointmentId: appt.id,
      },
    });

    const { TwilioWebhookService } = await import('../../../src/twilio/webhook.service.js');
    const svc = new TwilioWebhookService();
    await svc.cancelAppointment(reminder as any, '+573001234567');

    const log = await getLatestAuditLog('APPOINTMENT', appt.id);
    expect(log).toBeTruthy();
    expect(log!.actionType).toBe('UPDATE');
    expect(log!.description).toContain('cancelada via respuesta rápida de WhatsApp');
    expect(log!.affectedFields).toEqual(['status']);
    expect(log!.fieldsAfter).toMatchObject({ status: AppointmentStatus.CANCELLED });
  });
});

describe('Audit writing: actor metadata (integration)', () => {
  it('captures different actorId for system vs user context', async () => {
    const patient1 = await withAuditContext(() => patientService.create({
      name: 'Actor',
      lastName: 'Test',
      email: unique('patient@test.local'),
      status: 'ACTIVE',
    }, userId));
    const log1 = await getLatestAuditLog('PATIENT', patient1.id);
    expect(log1!.actorId).toBe(userId);

    const patient2 = await patientService.create({
      name: 'System',
      lastName: 'Actor',
      email: unique('patient@test.local'),
      status: 'ACTIVE',
    }, userId);
    const log2 = await getLatestAuditLog('PATIENT', patient2.id);
    expect(log2!.actorId).toBe('system');
    expect(log2!.actorDisplayName).toBe('Sistema');
  });
});
