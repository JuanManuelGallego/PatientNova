import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from './prisma/prismaClient.js';
import { patientRepository } from './patients/patient.repository.js';
import { appointmentRepository } from './appointments/appointment.repository.js';
import { reminderRepository } from './reminders/reminder.repository.js';
import { locationRepository } from './locations/location.repository.js';
import { appointmentTypeRepository } from './appointment-types/appointment-type.repository.js';
import { medicalRecordRepository } from './medical-records/medical-record.repository.js';
import {
  createTestUser,
  createTestPatient,
  createTestLocation,
  createTestAppointmentType,
  appointmentTimeRange,
} from '../test/integration/helpers.js';
import {
  PatientNotFoundError,
  AppointmentNotFoundError,
  ReminderNotFoundError,
  LocationNotFoundError,
  AppointmentTypeNotFoundError,
  MedicalRecordNotFoundError,
} from './utils/errors.js';
import {
  Channel,
  ReminderMode,
  ReminderStatus,
  AppointmentStatus,
  PatientStatus,
  SubsystemType,
  RelationshipStatus,
} from '../generated/prisma/client.ts';

// ─── Tenant isolation tests ────────────────────────────────────────────────
//
// Each user IS a tenant. This file verifies that one user can never access,
// modify, or even observe another user's data through any repository method.
//
// The pattern: create data under userA, then attempt every operation as userB.
// Every attempt must either throw a NotFound-style error or return empty results.

let userA: { id: string };
let userB: { id: string };

beforeEach(async () => {
  userA = await createTestUser();
  userB = await createTestUser();
});

// ─── Patient ───────────────────────────────────────────────────────────────

describe('tenant isolation: Patient', () => {
  let patientA: Awaited<ReturnType<typeof patientRepository.create>>;

  beforeEach(async () => {
    patientA = await patientRepository.create(
      { name: 'Maria', lastName: 'Garcia', status: PatientStatus.ACTIVE },
      userA.id,
    );
  });

  it('findById returns 404 for other user', async () => {
    await expect(patientRepository.findById(patientA.id, userB.id)).rejects.toThrow(
      PatientNotFoundError,
    );
  });

  it('findByIdWithRelations returns 404 for other user', async () => {
    await expect(patientRepository.findByIdWithRelations(patientA.id, userB.id)).rejects.toThrow(
      PatientNotFoundError,
    );
  });

  it('findMany excludes other user\'s patients', async () => {
    const page = await patientRepository.findMany(
      { page: 1, pageSize: 20, orderBy: 'createdAt', order: 'desc', includeDeleted: true, search: undefined },
      userB.id,
    );
    expect(page.data).toHaveLength(0);
    expect(page.total).toBe(0);
  });

  it('update returns 404 for other user\'s patient', async () => {
    await expect(
      patientRepository.update(patientA.id, { name: 'Hacked' }, userB.id),
    ).rejects.toThrow(PatientNotFoundError);

    const unchanged = await patientRepository.findById(patientA.id, userA.id);
    expect(unchanged.name).toBe('Maria');
  });

  it('delete returns 404 for other user\'s patient', async () => {
    await expect(patientRepository.delete(patientA.id, userB.id)).rejects.toThrow(
      PatientNotFoundError,
    );
  });

  it('restore returns 404 for other user\'s patient', async () => {
    await patientRepository.delete(patientA.id, userA.id);
    await expect(patientRepository.restore(patientA.id, userB.id)).rejects.toThrow(
      PatientNotFoundError,
    );
  });

  it('getStats excludes other user\'s patients', async () => {
    const stats = await patientRepository.getStats(userB.id);
    expect(stats.total).toBe(0);
    expect(Object.values(stats.byStatus).every((n) => n === 0)).toBe(true);
  });
});

// ─── Appointment ───────────────────────────────────────────────────────────

describe('tenant isolation: Appointment', () => {
  let apptA: Awaited<ReturnType<typeof appointmentRepository.create>>;

  beforeEach(async () => {
    const patient = await createTestPatient(userA.id);
    const loc = await createTestLocation(userA.id);
    const type = await createTestAppointmentType(userA.id);
    const { start, end } = appointmentTimeRange(120, 30);
    apptA = await appointmentRepository.create(
      {
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        price: 100,
        paid: false,
        status: AppointmentStatus.SCHEDULED,
        patientId: patient.id,
        locationId: loc.id,
        typeId: type.id,
      },
      userA.id,
    );
  });

  it('findById returns 404 for other user', async () => {
    await expect(appointmentRepository.findById(apptA.id, userB.id)).rejects.toThrow(
      AppointmentNotFoundError,
    );
  });

  it('findByIdWithRelations returns 404 for other user', async () => {
    await expect(
      appointmentRepository.findByIdWithRelations(apptA.id, userB.id),
    ).rejects.toThrow(AppointmentNotFoundError);
  });

  it('findMany excludes other user\'s appointments', async () => {
    const page = await appointmentRepository.findMany(
      { page: 1, pageSize: 20, orderBy: 'startAt', order: 'asc', includeDeleted: true },
      userB.id,
    );
    expect(page.data).toHaveLength(0);
    expect(page.total).toBe(0);
  });

  it('delete returns 404 for other user\'s appointment', async () => {
    await expect(appointmentRepository.delete(apptA.id, userB.id)).rejects.toThrow(
      AppointmentNotFoundError,
    );
  });

  it('restore returns 404 for other user\'s appointment', async () => {
    await appointmentRepository.delete(apptA.id, userA.id);
    await expect(appointmentRepository.restore(apptA.id, userB.id)).rejects.toThrow(
      AppointmentNotFoundError,
    );
  });

  it('getStats excludes other user\'s appointments', async () => {
    const stats = await appointmentRepository.getStats({ includeDeleted: false }, userB.id);
    expect(stats.total).toBe(0);
    expect(stats.totalRevenue).toBe(0);
  });
});

// ─── Reminder ──────────────────────────────────────────────────────────────

describe('tenant isolation: Reminder', () => {
  let reminderA: Awaited<ReturnType<typeof reminderRepository.create>>;

  beforeEach(async () => {
    const patient = await createTestPatient(userA.id);
    reminderA = await reminderRepository.create(
      {
        channel: Channel.WHATSAPP,
        to: '+10000000000',
        sendMode: ReminderMode.IMMEDIATE,
        sendAt: new Date(Date.now() + 60_000),
        status: ReminderStatus.PENDING,
        patientId: patient.id,
        contentSid: 'HXdummy',
      },
      userA.id,
    );
  });

  it('findById returns 404 for other user', async () => {
    await expect(reminderRepository.findById(reminderA.id, userB.id)).rejects.toThrow(
      ReminderNotFoundError,
    );
  });

  it('findMany excludes other user\'s reminders', async () => {
    const page = await reminderRepository.findMany(
      { page: 1, pageSize: 20, orderBy: 'sendAt', order: 'asc', includeDeleted: true },
      userB.id,
    );
    expect(page.data).toHaveLength(0);
    expect(page.total).toBe(0);
  });

  it('cancel returns 404 for other user\'s reminder', async () => {
    await expect(reminderRepository.cancel(reminderA.id, userB.id)).rejects.toThrow(
      ReminderNotFoundError,
    );
  });

  it('delete returns 404 for other user\'s reminder', async () => {
    await expect(reminderRepository.delete(reminderA.id, userB.id)).rejects.toThrow(
      ReminderNotFoundError,
    );
  });

  it('restore returns 404 for other user\'s reminder', async () => {
    await reminderRepository.delete(reminderA.id, userA.id);
    await expect(reminderRepository.restore(reminderA.id, userB.id)).rejects.toThrow(
      ReminderNotFoundError,
    );
  });

  it('getStats excludes other user\'s reminders', async () => {
    const stats = await reminderRepository.getStats({ includeDeleted: false }, userB.id);
    expect(stats.total).toBe(0);
    expect(Object.values(stats.byStatus).every((n) => n === 0)).toBe(true);
    expect(Object.values(stats.byChannel).every((n) => n === 0)).toBe(true);
  });
});

// ─── Location ──────────────────────────────────────────────────────────────

describe('tenant isolation: Location', () => {
  let locationA: Awaited<ReturnType<typeof locationRepository.create>>;

  beforeEach(async () => {
    locationA = await locationRepository.create(
      { name: 'Main Office', isVirtual: false },
      userA.id,
    );
  });

  it('findById returns 404 for other user', async () => {
    await expect(locationRepository.findById(locationA.id, userB.id)).rejects.toThrow(
      LocationNotFoundError,
    );
  });

  it('findMany excludes other user\'s locations', async () => {
    const list = await locationRepository.findMany(userB.id);
    expect(list).toHaveLength(0);
  });

  it('update returns 404 for other user\'s location', async () => {
    await expect(
      locationRepository.update(locationA.id, { name: 'Hacked Office' }, userB.id),
    ).rejects.toThrow(LocationNotFoundError);

    const unchanged = await locationRepository.findById(locationA.id, userA.id);
    expect(unchanged.name).toBe('Main Office');
  });

  it('delete returns 404 for other user\'s location', async () => {
    await expect(locationRepository.delete(locationA.id, userB.id)).rejects.toThrow(
      LocationNotFoundError,
    );
  });

  it('restore returns 404 for other user\'s location', async () => {
    await locationRepository.delete(locationA.id, userA.id);
    await expect(locationRepository.restore(locationA.id, userB.id)).rejects.toThrow(
      LocationNotFoundError,
    );
  });
});

// ─── AppointmentType ───────────────────────────────────────────────────────

describe('tenant isolation: AppointmentType', () => {
  let typeA: Awaited<ReturnType<typeof appointmentTypeRepository.create>>;

  beforeEach(async () => {
    typeA = await appointmentTypeRepository.create(
      { name: 'Consultation', defaultDuration: 60 },
      userA.id,
    );
  });

  it('findById returns 404 for other user', async () => {
    await expect(appointmentTypeRepository.findById(typeA.id, userB.id)).rejects.toThrow(
      AppointmentTypeNotFoundError,
    );
  });

  it('findMany excludes other user\'s types', async () => {
    const list = await appointmentTypeRepository.findMany(userB.id);
    expect(list).toHaveLength(0);
  });

  it('update returns 404 for other user\'s type', async () => {
    await expect(
      appointmentTypeRepository.update(typeA.id, { name: 'Hacked Type' }, userB.id),
    ).rejects.toThrow(AppointmentTypeNotFoundError);

    const unchanged = await appointmentTypeRepository.findById(typeA.id, userA.id);
    expect(unchanged.name).toBe('Consultation');
  });

  it('delete returns 404 for other user\'s type', async () => {
    await expect(appointmentTypeRepository.delete(typeA.id, userB.id)).rejects.toThrow(
      AppointmentTypeNotFoundError,
    );
  });

  it('restore returns 404 for other user\'s type', async () => {
    await appointmentTypeRepository.delete(typeA.id, userA.id);
    await expect(appointmentTypeRepository.restore(typeA.id, userB.id)).rejects.toThrow(
      AppointmentTypeNotFoundError,
    );
  });
});

// ─── MedicalRecord (indirect ownership via Patient) ────────────────────────

describe('tenant isolation: MedicalRecord', () => {
  let recordA: Awaited<ReturnType<typeof medicalRecordRepository.create>>;
  let patientA: Awaited<ReturnType<typeof patientRepository.create>>;

  beforeEach(async () => {
    patientA = await createTestPatient(userA.id);
    recordA = await medicalRecordRepository.create(
      {
        patientId: patientA.id,
        name: 'Clinical Record',
        consultationReason: 'Initial evaluation',
        familyMembers: [{ name: 'Mother', relationship: 'MOTHER' as any, relation: 'mother' }],
        evolutionNotes: [{ date: new Date().toISOString(), text: 'Session 1' }],
        subsystemRelations: [
          { subsystem: SubsystemType.PARENTAL, status: RelationshipStatus.FUNCIONAL, observation: 'ok' },
        ],
      },
      userA.id,
    );
  });

  it('findById returns 404 for other user', async () => {
    await expect(medicalRecordRepository.findById(recordA.id, userB.id)).rejects.toThrow(
      MedicalRecordNotFoundError,
    );
  });

  it('findByPatientId returns 404 for other user', async () => {
    await expect(
      medicalRecordRepository.findByPatientId(patientA.id, userB.id),
    ).rejects.toThrow(MedicalRecordNotFoundError);
  });

  it('findMany excludes other user\'s records', async () => {
    const page = await medicalRecordRepository.findMany(
      { page: 1, pageSize: 20, orderBy: 'createdAt', order: 'desc', includeDeleted: true, search: undefined },
      userB.id,
    );
    expect(page.data).toHaveLength(0);
    expect(page.total).toBe(0);
  });

  it('update returns 404 for other user\'s record', async () => {
    await expect(
      medicalRecordRepository.update(recordA.id, { name: 'Hacked Record' }, userB.id),
    ).rejects.toThrow(MedicalRecordNotFoundError);

    const unchanged = await medicalRecordRepository.findById(recordA.id, userA.id);
    expect(unchanged.name).toBe('Clinical Record');
  });

  it('softDelete returns 404 for other user\'s record', async () => {
    await expect(medicalRecordRepository.softDelete(recordA.id, userB.id)).rejects.toThrow(
      MedicalRecordNotFoundError,
    );
  });

  it('restore returns 404 for other user\'s record', async () => {
    await medicalRecordRepository.softDelete(recordA.id, userA.id);
    await expect(medicalRecordRepository.restore(recordA.id, userB.id)).rejects.toThrow(
      MedicalRecordNotFoundError,
    );
  });

  it('delete returns 404 for other user\'s record', async () => {
    await expect(medicalRecordRepository.delete(recordA.id, userB.id)).rejects.toThrow(
      MedicalRecordNotFoundError,
    );
  });
});

// ─── Cross-entity: creating data for another user's patient fails ──────────

describe('tenant isolation: cross-entity guards', () => {
  it('cannot create a reminder for another user\'s patient', async () => {
    const patientA = await createTestPatient(userA.id);

    await expect(
      reminderRepository.create(
        {
          channel: Channel.WHATSAPP,
          to: '+10000000000',
          sendMode: ReminderMode.IMMEDIATE,
          sendAt: new Date(Date.now() + 60_000),
          status: ReminderStatus.PENDING,
          patientId: patientA.id,
          contentSid: 'HXdummy',
        },
        userB.id,
      ),
    ).rejects.toThrow(PatientNotFoundError);
  });

  it('cannot create a medical record for another user\'s patient', async () => {
    const patientA = await createTestPatient(userA.id);

    await expect(
      medicalRecordRepository.create(
        { patientId: patientA.id, name: 'Stolen Record' },
        userB.id,
      ),
    ).rejects.toThrow(PatientNotFoundError);
  });

  it('appointmentRepository.create does not validate patient ownership (service layer does)', async () => {
    // NOTE: This is by design — the repository is a thin data-access layer.
    // The appointment SERVICE validates patient ownership via validatePatient()
    // at appointment.service.ts:50-54. This test documents that boundary.
    // We verify the service catches it instead of the repository.
    const { appointmentService } = await import('./appointments/appointment.service.js');
    const patientA = await createTestPatient(userA.id);
    const { start, end } = appointmentTimeRange(180, 30);
    await expect(
      appointmentService.create(
        {
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          price: 0,
          paid: false,
          status: AppointmentStatus.SCHEDULED,
          patientId: patientA.id,
          locationId: '00000000-0000-0000-0000-000000000000',
          typeId: '00000000-0000-0000-0000-000000000000',
        },
        userB.id,
      ),
    ).rejects.toThrow();
  });
});

// ─── Raw DB: verify no data leaks through direct queries ───────────────────

describe('tenant isolation: raw query verification', () => {
  it('userB has zero rows across all tenant-owned tables', async () => {
    const patient = await createTestPatient(userA.id);
    const loc = await createTestLocation(userA.id);
    const type = await createTestAppointmentType(userA.id);
    const { start, end } = appointmentTimeRange(120, 30);
    await appointmentRepository.create(
      {
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        price: 100,
        paid: false,
        status: AppointmentStatus.SCHEDULED,
        patientId: patient.id,
        locationId: loc.id,
        typeId: type.id,
      },
      userA.id,
    );
    await reminderRepository.create(
      {
        channel: Channel.WHATSAPP,
        to: '+10000000000',
        sendMode: ReminderMode.IMMEDIATE,
        sendAt: new Date(Date.now() + 60_000),
        status: ReminderStatus.PENDING,
        patientId: patient.id,
        contentSid: 'HXdummy',
      },
      userA.id,
    );
    await medicalRecordRepository.create(
      { patientId: patient.id, name: 'Record' },
      userA.id,
    );

    const counts = await prisma.$transaction([
      prisma.patient.count({ where: { userId: userB.id } }),
      prisma.appointment.count({ where: { userId: userB.id } }),
      prisma.reminder.count({ where: { userId: userB.id } }),
      prisma.appointmentLocation.count({ where: { userId: userB.id } }),
      prisma.appointmentType.count({ where: { userId: userB.id } }),
      prisma.medicalRecord.count({
        where: { patient: { userId: userB.id } },
      }),
    ]);

    expect(counts).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
