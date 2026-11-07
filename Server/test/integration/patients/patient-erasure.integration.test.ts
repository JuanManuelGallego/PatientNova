import { describe, expect, it } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { logAudit } from '../../../src/audit-log/audit-log.utils.js';
import { portalActorId } from '../../../src/audit-log/audit-actors.js';
import { erasePatient, ERASED_TEXT } from '../../../src/patients/patient-erasure.service.js';
import {
  ActionSource,
  ActionType,
  AppointmentStatus,
  BookingRequestKind,
  Channel,
  ConsentKind,
  EntityType,
  ReminderMode,
  ReminderStatus,
} from '../../../generated/prisma/enums.js';
import { appointmentTimeRange, createTestAppointmentType, createTestLocation, createTestPatient, createTestUser, unique } from '../helpers.js';

const UNKNOWN = '00000000-0000-4000-8000-000000000000';

async function seed() {
  const user = await createTestUser();
  const email = unique('ana@test.local').toLowerCase();
  const patient = await createTestPatient(user.id, { name: 'Anabel', lastName: 'Quintero', email });
  const other = await createTestPatient(user.id, { name: 'Beatriz', lastName: 'Rojas' });
  const location = await createTestLocation(user.id);
  const type = await createTestAppointmentType(user.id);
  const range = appointmentTimeRange();
  const appointment = await prisma.appointment.create({
    data: {
      userId: user.id, patientId: patient.id, typeId: type.id, locationId: location.id, price: 0,
      status: AppointmentStatus.SCHEDULED, startAt: range.start, endAt: range.end,
    } as never,
  });
  const reminder = await prisma.reminder.create({
    data: {
      userId: user.id, patientId: patient.id, appointmentId: appointment.id, channel: Channel.EMAIL, to: email, subject: 'R', body: 'C',
      sendMode: ReminderMode.SCHEDULED, sendAt: new Date(Date.now() + 86_400_000), status: ReminderStatus.PENDING,
    },
  });
  const consent = await prisma.patientConsent.create({
    data: { patientId: patient.id, userId: user.id, kind: ConsentKind.DATA_PROCESSING, policyVersion: 'v1', acceptedAt: new Date() },
  });
  const record = await prisma.medicalRecord.create({ data: { patientId: patient.id, name: 'Anabel Quintero' } as never });
  await prisma.evolutionNote.create({ data: { medicalRecordId: record.id, text: 'Nota', date: new Date() } as never });
  return { user, patient, other, appointment, reminder, consent, record, email };
}

const audit = (userId: string, entityType: EntityType, entityId: string, description: string, extra: object = {}) => logAudit({
  entityType, entityId, userId, actionType: ActionType.UPDATE, description, required: true, ...extra,
});

describe('erasePatient', () => {
  it('reports what it would remove and changes nothing without confirmation', async () => {
    const { patient } = await seed();

    const result = await erasePatient(patient.id);

    expect(result).toMatchObject({ erased: false, appointments: 1, reminders: 1, consents: 1, medicalRecord: true });
    expect(await prisma.patient.count({ where: { id: patient.id } })).toBe(1);
  });

  it('removes the patient and every related row, despite the consent restriction', async () => {
    const { patient, appointment, reminder, consent, record } = await seed();

    const result = await erasePatient(patient.id, { confirm: true });

    expect(result.erased).toBe(true);
    expect(await prisma.patient.count({ where: { id: patient.id } })).toBe(0);
    expect(await prisma.appointment.count({ where: { id: appointment.id } })).toBe(0);
    expect(await prisma.reminder.count({ where: { id: reminder.id } })).toBe(0);
    expect(await prisma.patientConsent.count({ where: { id: consent.id } })).toBe(0);
    expect(await prisma.medicalRecord.count({ where: { id: record.id } })).toBe(0);
    expect(await prisma.evolutionNote.count({ where: { medicalRecordId: record.id } })).toBe(0);
  });

  it('removes the booking requests sent from the patient\'s contact', async () => {
    const { user, patient, email } = await seed();
    const location = await createTestLocation(user.id, { name: 'Otra' });
    const type = await createTestAppointmentType(user.id, { name: 'Otro' });
    const start = new Date(Date.now() + 7 * 86_400_000);
    const request = await prisma.bookingRequest.create({
      data: {
        userId: user.id, kind: BookingRequestKind.NEW, email, name: 'Anabel', lastName: 'Quintero', typeId: type.id, locationId: location.id,
        startAt: start, endAt: new Date(start.getTime() + 3_600_000), holdExpiresAt: start, patientTimezone: 'America/Bogota',
        policyVersion: 'v1', consentAcceptedAt: new Date(),
      },
    });

    await erasePatient(patient.id, { confirm: true });

    expect(await prisma.bookingRequest.count({ where: { id: request.id } })).toBe(0);
  });

  it('redacts audit rows but keeps who, what and when', async () => {
    const { user, patient, appointment } = await seed();
    await audit(user.id, EntityType.PATIENT, patient.id, 'Paciente eliminado Anabel Quintero', {
      affectedFields: [ 'name' ], fieldsBefore: { name: 'Anabel' }, fieldsAfter: { name: 'Ana' },
    });
    await audit(user.id, EntityType.APPOINTMENT, appointment.id, 'Cita de Anabel Quintero movida');
    const [ before ] = await prisma.auditLog.findMany({ where: { entityId: patient.id } });

    await erasePatient(patient.id, { confirm: true });

    const row = await prisma.auditLog.findUniqueOrThrow({ where: { id: before!.id } });
    expect(row.description).toBe(ERASED_TEXT);
    expect(row.fieldsBefore).toBeNull();
    expect(row.fieldsAfter).toBeNull();
    expect(row.actionType).toBe(ActionType.UPDATE);
    expect(row.eventTimeUtc).toEqual(before!.eventTimeUtc);
    expect(row.affectedFields).toEqual([ 'name' ]);
    const linked = await prisma.auditLog.findFirstOrThrow({ where: { entityType: EntityType.APPOINTMENT, entityId: appointment.id } });
    expect(linked.description).toBe(ERASED_TEXT);
  });

  it('redacts a row that only mentions the patient, and leaves others alone', async () => {
    const { user, patient, other } = await seed();
    await audit(user.id, EntityType.USER, user.id, 'Envío masivo a Anabel Quintero');
    await audit(user.id, EntityType.PATIENT, other.id, 'Paciente actualizado Beatriz Rojas');

    await erasePatient(patient.id, { confirm: true });

    expect((await prisma.auditLog.findFirstOrThrow({ where: { entityType: EntityType.USER, entityId: user.id } })).description).toBe(ERASED_TEXT);
    expect((await prisma.auditLog.findFirstOrThrow({ where: { entityId: other.id } })).description).toBe('Paciente actualizado Beatriz Rojas');
  });

  it('does not match another person whose name only contains the first name', async () => {
    const { user, patient } = await seed();
    await audit(user.id, EntityType.USER, user.id, 'Cambio de Anabel Gomez');

    await erasePatient(patient.id, { confirm: true });

    expect((await prisma.auditLog.findFirstOrThrow({ where: { entityType: EntityType.USER, entityId: user.id } })).description).toBe('Cambio de Anabel Gomez');
  });

  it('removes the portal actor from the patient\'s portal rows', async () => {
    const { user, patient, email } = await seed();
    const actorId = portalActorId(user.id, email);
    const row = await prisma.auditLog.create({
      data: {
        userId: user.id, actorId, actorDisplayName: 'Paciente (portal) a***@test.local', entityType: EntityType.BOOKING_REQUEST,
        entityId: 'request-1', actionType: ActionType.CREATE, source: ActionSource.PUBLIC_PORTAL, description: 'Inicio de sesión', ipAddress: '203.0.113.7',
      },
    });

    await erasePatient(patient.id, { confirm: true });

    const after = await prisma.auditLog.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.actorId).not.toBe(actorId);
    expect(after.actorDisplayName).toBe(ERASED_TEXT);
    expect(after.ipAddress).toBeNull();
  });

  it('leaves one audit row for the erasure itself, with no personal data', async () => {
    const { user, patient } = await seed();

    await erasePatient(patient.id, { confirm: true });

    const rows = await prisma.auditLog.findMany({ where: { userId: user.id, entityType: EntityType.PATIENT, entityId: patient.id, actionType: ActionType.DELETE } });
    expect(rows).toHaveLength(1);
    expect(rows[ 0 ]!.actorId).toBe('privacy-operator');
    expect(rows[ 0 ]!.source).toBe(ActionSource.JOB);
    expect(JSON.stringify(rows[ 0 ])).not.toContain('Quintero');
  });

  it('leaves the other patient and other tenants untouched', async () => {
    const { patient, other } = await seed();
    const stranger = await createTestUser();
    const theirs = await createTestPatient(stranger.id, { name: 'Anabel', lastName: 'Quintero' });
    await audit(stranger.id, EntityType.PATIENT, theirs.id, 'Paciente actualizado Anabel Quintero');

    await erasePatient(patient.id, { confirm: true });

    expect(await prisma.patient.count({ where: { id: { in: [ other.id, theirs.id ] } } })).toBe(2);
    expect((await prisma.auditLog.findFirstOrThrow({ where: { entityId: theirs.id } })).description).toBe('Paciente actualizado Anabel Quintero');
  });

  it('fails loudly for an unknown patient', async () => {
    await expect(erasePatient(UNKNOWN, { confirm: true })).rejects.toThrow('Patient not found');
  });
});
