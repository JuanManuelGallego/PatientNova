import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/twilio/client.js', () => ({
  sendWhatsApp: vi.fn().mockResolvedValue({ success: true, messageSid: 'SMwelcome', channel: 'WHATSAPP', to: '+573001112233' }),
  sendSms: vi.fn().mockResolvedValue({ success: true, messageSid: 'SMsms', channel: 'SMS', to: '+573001112233' }),
  sendWhatsAppFreeForm: vi.fn(),
  getMessageStatus: vi.fn(),
}));
vi.mock('../../../src/brevo/email-client.js', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, messageSid: '<welcome@smtp>', channel: 'EMAIL', to: 'ana@test.local' }),
}));
vi.mock('../../../src/scheduler/reminder-job-manager.js', () => ({
  reminderJobManager: {
    enqueue: vi.fn().mockResolvedValue(undefined),
    enqueueImmediate: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    reschedule: vi.fn().mockResolvedValue(undefined),
    hasQueuedJob: vi.fn().mockResolvedValue(false),
  },
}));

import { sendSms, sendWhatsApp } from '../../../src/twilio/client.js';
import { sendEmail } from '../../../src/brevo/email-client.js';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { patientRouter } from '../../../src/patients/patient.routes.js';
import { patientTypeService } from '../../../src/patient-types/patient-type.service.js';
import { WHATSAPP_TEMPLATES } from '../../../src/twilio/whatsapp-templates.js';
import { Channel, ReminderStatus } from '../../../generated/prisma/client.ts';
import { authReq, createTestPatient, createTestUser, invokeRoute } from '../helpers.js';

const pdf = (text: string) => Buffer.from(`%PDF-1.4 ${text}`).toString('base64');
const BANKING = { displayName: 'Dra. Ana', bankName: 'Bancolombia', accountNumber: '123-456', nationalId: '1020304050', bankingKey: '@ana' };

let user: Awaited<ReturnType<typeof createTestUser>>;

beforeEach(async () => {
  vi.clearAllMocks();
  user = await createTestUser();
  await prisma.user.update({ where: { id: user.id }, data: BANKING });
});

const welcome = (patientId: string) =>
  invokeRoute(patientRouter, 'post', `/${patientId}/welcome`, { ...authReq(user), params: { id: patientId } });

async function whatsappPatient(patientTypeId = user.defaultPatientTypeId) {
  const patient = await createTestPatient(user.id, { patientTypeId });
  return prisma.patient.update({ where: { id: patient.id }, data: { reminderChannel: Channel.WHATSAPP, whatsappNumber: '+573001112233' } });
}

describe('POST /patients/:id/welcome', () => {
  it("sends the WhatsApp template linking the current consent version of the patient's type, and audits it", async () => {
    const family = await patientTypeService.create(user.id, { name: 'Familia' });
    await patientTypeService.addVersion(user.id, user.defaultPatientTypeId, { name: 'General.pdf', content: pdf('general') });
    await patientTypeService.addVersion(user.id, family.id, { name: 'Familia.pdf', content: pdf('v1') });
    const current = await patientTypeService.addVersion(user.id, family.id, { name: 'Familia.pdf', content: pdf('v2') });
    const patient = await whatsappPatient(family.id);

    const res = await welcome(patient.id);
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toMatchObject({ channel: 'WHATSAPP', consentVersionId: current.id });

    expect(sendWhatsApp).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendWhatsApp).mock.calls[ 0 ]![ 0 ]).toMatchObject({
      to: '+573001112233',
      contentSid: WHATSAPP_TEMPLATES.patientWelcomeSid,
      contentVariables: {
        '1': 'Maria', '2': 'Dra. Ana', '3': 'Bancolombia', '4': '123-456', '5': 'Test User', '6': '1020304050', '7': '@ana', '8': current.id,
      },
    });

    const reminder = await prisma.reminder.findUniqueOrThrow({ where: { id: res.body.data.reminderId } });
    expect(reminder).toMatchObject({ patientId: patient.id, status: ReminderStatus.QUEUED, messageId: 'SMwelcome' });

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityType: 'CONSENT_DOCUMENT', entityId: current.id, actionType: 'SEND' } });
    expect(audit.fieldsAfter).toMatchObject({ patientId: patient.id, patientTypeId: family.id, version: 2, channel: 'WHATSAPP' });
  });

  it('sends the same text on email, with the variables filled in and the consent link written out', async () => {
    const version = await patientTypeService.addVersion(user.id, user.defaultPatientTypeId, { name: 'Consent.pdf', content: pdf('v1') });
    const patient = await createTestPatient(user.id);
    await prisma.patient.update({ where: { id: patient.id }, data: { reminderChannel: Channel.EMAIL } });

    const res = await welcome(patient.id);
    expect(res.statusCode).toBe(201);
    const body = vi.mocked(sendEmail).mock.calls[ 0 ]![ 0 ].body;
    expect(body).toContain('¡Hola Maria!');
    expect(body).toContain('Banco: Bancolombia');
    expect(body).toContain(`consentimiento antes de tu primera consulta: https://example.com/v1/consent-document/public/download/${version.id}.pdf`);
    expect(body).not.toContain('adjunto');
    expect(body).not.toMatch(/\{\{\d\}\}/);
    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
  });

  it('writes the consent link into the SMS too, with the extension of a migrated image', async () => {
    const legacy = await prisma.consentDocumentVersion.create({
      data: { patientTypeId: user.defaultPatientTypeId, version: 1, name: 'Scan.jpeg', content: new Uint8Array(Buffer.from('jpeg')), mimeType: 'image/jpeg', sizeBytes: 4 },
    });
    const patient = await createTestPatient(user.id);
    await prisma.patient.update({ where: { id: patient.id }, data: { reminderChannel: Channel.SMS, smsNumber: '+573001112244', email: null } });

    expect((await welcome(patient.id)).statusCode).toBe(201);
    const sms = vi.mocked(sendSms).mock.calls[ 0 ]![ 0 ];
    expect(sms.to).toBe('+573001112244');
    expect(sms.body).toContain(`https://example.com/v1/consent-document/public/download/${legacy.id}.jpeg`);
  });

  it("refuses (409) before sending when the patient's type has no consent PDF", async () => {
    const patient = await whatsappPatient();
    const res = await welcome(patient.id);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toContain('formulario de consentimiento');
    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(await prisma.reminder.count()).toBe(0);
  });

  it("refuses (409) before sending when the provider's banking details are incomplete", async () => {
    await patientTypeService.addVersion(user.id, user.defaultPatientTypeId, { name: 'Consent.pdf', content: pdf('v1') });
    await prisma.user.update({ where: { id: user.id }, data: { bankingKey: null } });
    const patient = await whatsappPatient();
    const res = await welcome(patient.id);
    expect(res.statusCode).toBe(409);
    expect(sendWhatsApp).not.toHaveBeenCalled();
  });

  it('refuses (409) when the patient has no usable contact (an unverified number, or messages stopped)', async () => {
    await patientTypeService.addVersion(user.id, user.defaultPatientTypeId, { name: 'Consent.pdf', content: pdf('v1') });
    const patient = await whatsappPatient();
    await prisma.patient.update({ where: { id: patient.id }, data: { email: null, whatsappUnverified: true } });
    expect((await welcome(patient.id)).statusCode).toBe(409);

    await prisma.patient.update({ where: { id: patient.id }, data: { whatsappUnverified: false, messagesStoppedAt: new Date() } });
    expect((await welcome(patient.id)).statusCode).toBe(409);
    expect(sendWhatsApp).not.toHaveBeenCalled();
  });

  it("answers 404 for another provider's patient", async () => {
    const other = await createTestUser();
    const theirs = await createTestPatient(other.id);
    expect((await welcome(theirs.id)).statusCode).toBe(404);
  });
});
