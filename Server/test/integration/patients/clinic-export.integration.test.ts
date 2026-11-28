import { describe, expect, it } from 'vitest';
import { prisma } from '../../../src/utils/prisma/prisma-client.js';
import { buildClinicExport } from '../../../src/patients/clinic-export.service.js';
import { AppointmentStatus } from '../../../generated/prisma/enums.js';
import { appointmentTimeRange, createTestAppointmentType, createTestLocation, createTestPatient, createTestUser } from '../helpers.js';

async function seedClinic() {
  const user = await createTestUser();
  const patient = await createTestPatient(user.id, { name: 'Anabel', lastName: 'Quintero' });
  const location = await createTestLocation(user.id);
  const type = await createTestAppointmentType(user.id);
  const range = appointmentTimeRange();
  await prisma.appointment.create({
    data: {
      userId: user.id, patientId: patient.id, typeId: type.id, locationId: location.id, price: 0,
      status: AppointmentStatus.SCHEDULED, startAt: range.start, endAt: range.end,
    } as never,
  });
  const record = await prisma.medicalRecord.create({ data: { patientId: patient.id, name: 'Anabel Quintero', data: '{"objective":"Actual"}' } as never });
  await prisma.medicalRecordSnapshot.create({
    data: { medicalRecordId: record.id, patientTypeId: patient.patientTypeId, patientTypeName: 'Individual', template: { sections: [] }, data: '{"objective":"Archivado"}' },
  });
  await prisma.evolutionNote.create({ data: { medicalRecordId: record.id, text: 'Nota clínica', date: new Date() } as never });
  return { user, patient };
}

describe('buildClinicExport', () => {
  it('holds the clinic\'s patients readable, with their appointments and medical record', async () => {
    const { user, patient } = await seedClinic();

    const result = await buildClinicExport(user.id);

    expect(result.patients).toHaveLength(1);
    expect(result.patients[ 0 ]).toMatchObject({ id: patient.id, name: 'Anabel', lastName: 'Quintero' });
    expect(result.patients[ 0 ]!.appointments).toHaveLength(1);
    expect(result.patients[ 0 ]!.medicalRecord?.evolutionNotes[ 0 ]?.text).toBe('Nota clínica');
  });

  it('exports the record payload and its snapshots as objects', async () => {
    const { user } = await seedClinic();

    const record = (await buildClinicExport(user.id)).patients[ 0 ]!.medicalRecord as any;

    expect(record.data).toEqual({ objective: 'Actual' });
    expect(record.snapshots.map((s: any) => [ s.patientTypeName, s.data ])).toEqual([ [ 'Individual', { objective: 'Archivado' } ] ]);
  });

  it('gives each patient its type with the template', async () => {
    const { user } = await seedClinic();

    const [ patient ] = (await buildClinicExport(user.id)).patients as any[];

    expect(patient.patientType).toMatchObject({ name: expect.any(String), template: { sections: expect.any(Array) } });
  });

  it('leaves out search indexes, which are useless outside the platform', async () => {
    const { user } = await seedClinic();

    const [ row ] = (await buildClinicExport(user.id)).patients;

    expect(row).not.toHaveProperty('emailHash');
    expect(row).not.toHaveProperty('nameTokens');
  });

  it('includes soft-deleted patients, which the clinic may still have to keep', async () => {
    const { user, patient } = await seedClinic();
    await prisma.patient.update({ where: { id: patient.id }, data: { isDeleted: true } });

    expect((await buildClinicExport(user.id)).patients).toHaveLength(1);
  });

  it('never includes another clinic\'s data', async () => {
    const { user } = await seedClinic();
    const { user: stranger } = await seedClinic();

    const result = await buildClinicExport(user.id);

    expect(result.patients.every((p) => p.userId === user.id)).toBe(true);
    expect(result.patients.some((p) => p.userId === stranger.id)).toBe(false);
  });

  it('fails loudly for an unknown clinic', async () => {
    await expect(buildClinicExport('missing-clinic')).rejects.toThrow('Clinic not found');
  });
});
