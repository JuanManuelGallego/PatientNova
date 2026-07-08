// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appointmentService } from './appointment.service.js';

vi.mock('../prisma/prismaClient.js', () => ({
  prisma: {
    patient: { findFirst: vi.fn() },
    appointmentLocation: { findUnique: vi.fn() },
    appointmentType: { findUnique: vi.fn() },
    reminder: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    appointment: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../google/google-meet.service.js', () => ({
  googleMeetService: {
    createMeetingSpace: vi.fn().mockResolvedValue({ meetingUrl: 'https://meet.google.com/abc-defg-hij' }),
  },
}));

import { prisma } from '../prisma/prismaClient.js';
import { googleMeetService } from '../google/google-meet.service.js';

const mockPrisma = vi.mocked(prisma);
const mockGoogleMeet = vi.mocked(googleMeetService);

function mockTx() {
  const tx = {
    reminder: {
      create: vi.fn().mockResolvedValue({ id: 'reminder-new-1', contentVariables: {} }),
      update: vi.fn().mockResolvedValue({}),
    },
    appointment: {
      create: vi.fn().mockResolvedValue({
        id: 'appt-1',
        startAt: new Date(),
        endAt: new Date(),
        patientId: 'patient-1',
        userId: 'user-1',
        reminderId: null,
        patient: { id: 'patient-1', name: 'John', lastName: 'Doe', email: 'john@test.com' },
        reminder: null,
        appointmentLocation: { id: 'loc-1', name: 'Office', isVirtual: false },
        appointmentType: { id: 'type-1', name: 'Consult' },
      }),
      update: vi.fn().mockImplementation((_args: any) =>
        Promise.resolve({
          id: 'appt-1',
          startAt: new Date(),
          endAt: new Date(),
          patientId: 'patient-1',
          userId: 'user-1',
          reminderId: null,
          patient: { id: 'patient-1', name: 'John', lastName: 'Doe', email: 'john@test.com' },
          reminder: null,
          appointmentLocation: { id: 'loc-1', name: 'Office', isVirtual: false },
          appointmentType: { id: 'type-1', name: 'Consult' },
        })
      ),
    },
  };
  return tx;
}

const futureDate = new Date(Date.now() + 86400000).toISOString();
const validDto = {
  startAt: futureDate,
  endAt: new Date(Date.now() + 2 * 86400000).toISOString(),
  price: 100,
  patientId: 'patient-1',
  locationId: 'loc-1',
  typeId: 'type-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.appointmentType.findUnique.mockResolvedValue({ id: 'type-1' } as any);
  mockPrisma.appointment.findFirst.mockResolvedValue(null);
  mockPrisma.patient.findFirst.mockResolvedValue({ id: 'patient-1', userId: 'user-1' } as any);
  mockPrisma.appointmentLocation.findUnique.mockResolvedValue({ id: 'loc-1', isVirtual: false } as any);
});

describe('appointmentService.create', () => {
  it('creates appointment without reminder in a transaction', async () => {
    const tx = mockTx();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await appointmentService.create(validDto, 'user-1');

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(tx.appointment.create).toHaveBeenCalled();
    expect(tx.reminder.create).not.toHaveBeenCalled();
    expect(result.id).toBe('appt-1');
  });

  it('creates reminder and appointment atomically', async () => {
    const tx = mockTx();
    tx.reminder.create.mockResolvedValue({ id: 'reminder-new-1', contentVariables: {} });
    tx.appointment.create.mockResolvedValue({
      id: 'appt-1',
      reminderId: 'reminder-new-1',
      patient: { id: 'patient-1', name: 'John', lastName: 'Doe', email: 'john@test.com' },
      reminder: { id: 'reminder-new-1' },
      appointmentLocation: { id: 'loc-1', name: 'Office', isVirtual: false },
      appointmentType: { id: 'type-1', name: 'Consult' },
    });
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const dtoWithReminder = {
      ...validDto,
      reminder: {
        channel: 'WHATSAPP' as const,
        to: '+15551234567',
        sendMode: 'SCHEDULED' as const,
        sendAt: futureDate,
      },
    };

    const result = await appointmentService.create(dtoWithReminder, 'user-1');

    expect(tx.reminder.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        channel: 'WHATSAPP',
        to: '+15551234567',
        sendMode: 'SCHEDULED',
        patientId: 'patient-1',
        userId: 'user-1',
      }),
    }));
    expect(tx.appointment.create).toHaveBeenCalled();
    expect(tx.reminder.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'reminder-new-1' },
      data: { appointmentId: 'appt-1' },
    }));
  });

  it('generates meeting URL for virtual location and updates reminder', async () => {
    const tx = mockTx();
    tx.reminder.create.mockResolvedValue({ id: 'reminder-new-1', contentVariables: {} });
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    mockPrisma.appointmentLocation.findUnique.mockResolvedValue({ id: 'loc-1', isVirtual: true } as any);
    mockGoogleMeet.createMeetingSpace.mockResolvedValue({ meetingUrl: 'https://meet.google.com/new-url' });

    const dtoWithReminder = {
      ...validDto,
      reminder: {
        channel: 'WHATSAPP' as const,
        to: '+15551234567',
        sendMode: 'SCHEDULED' as const,
        sendAt: futureDate,
        contentVariables: { '1': 'John' },
      },
    };

    await appointmentService.create(dtoWithReminder, 'user-1');

    expect(mockGoogleMeet.createMeetingSpace).toHaveBeenCalled();
    expect(tx.reminder.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'reminder-new-1' },
      data: { contentVariables: expect.objectContaining({ '5': 'https://meet.google.com/new-url' }) },
    }));
  });

  it('rolls back if appointment creation fails after reminder creation', async () => {
    const tx = mockTx();
    tx.reminder.create.mockResolvedValue({ id: 'reminder-new-1', contentVariables: {} });
    tx.appointment.create.mockRejectedValue(new Error('DB error'));
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const dtoWithReminder = {
      ...validDto,
      reminder: {
        channel: 'WHATSAPP' as const,
        to: '+15551234567',
        sendMode: 'IMMEDIATE' as const,
      },
    };

    await expect(appointmentService.create(dtoWithReminder, 'user-1')).rejects.toThrow('DB error');
    expect(tx.reminder.create).toHaveBeenCalled();
    expect(tx.appointment.create).toHaveBeenCalled();
  });

  it('creates IMMEDIATE reminder without sendAt', async () => {
    const tx = mockTx();
    tx.reminder.create.mockResolvedValue({ id: 'reminder-new-1', contentVariables: {} });
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const dtoWithImmediate = {
      ...validDto,
      reminder: {
        channel: 'SMS' as const,
        to: '+15559876543',
        sendMode: 'IMMEDIATE' as const,
      },
    };

    await appointmentService.create(dtoWithImmediate, 'user-1');

    expect(tx.reminder.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        sendMode: 'IMMEDIATE',
        sendAt: expect.any(Date),
      }),
    }));
  });

  it('throws when type is not found', async () => {
    mockPrisma.appointmentType.findUnique.mockResolvedValue(null);

    await expect(
      appointmentService.create({ ...validDto, typeId: 'bad' }, 'user-1')
    ).rejects.toThrow();
  });

  it('throws when patient is not found', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null);

    await expect(
      appointmentService.create(validDto, 'user-1')
    ).rejects.toThrow();
  });

  it('throws on scheduling conflict', async () => {
    mockPrisma.appointment.findFirst.mockResolvedValue({
      startAt: new Date(validDto.startAt),
      endAt: new Date(validDto.endAt),
    } as any);

    await expect(
      appointmentService.create(validDto, 'user-1')
    ).rejects.toThrow();
  });
});

describe('appointmentService.update', () => {
  const existingAppt = {
    id: 'appt-1',
    startAt: new Date(),
    endAt: new Date(),
    patientId: 'patient-1',
    userId: 'user-1',
    reminderId: null,
    meetingUrl: null,
    patient: { id: 'patient-1', name: 'John', lastName: 'Doe', email: 'john@test.com' },
    reminder: null,
    appointmentLocation: { id: 'loc-1', name: 'Office', isVirtual: false },
    appointmentType: { id: 'type-1', name: 'Consult' },
  };

  beforeEach(() => {
    mockPrisma.appointment.findFirst.mockResolvedValue(existingAppt as any);
  });

  it('updates appointment without reminder change', async () => {
    const updatedAppt = { ...existingAppt, price: 200 };
    mockPrisma.appointment.update.mockResolvedValue(updatedAppt as any);

    const result = await appointmentService.update('appt-1', { price: 200 }, 'user-1');

    expect(mockPrisma.appointment.update).toHaveBeenCalled();
    expect(result.id).toBe('appt-1');
  });

  it('creates reminder when adding to existing appointment', async () => {
    const tx = mockTx();
    tx.reminder.create.mockResolvedValue({ id: 'reminder-new-1', contentVariables: {} });
    tx.appointment.update.mockResolvedValue({ ...existingAppt, reminderId: 'reminder-new-1' } as any);
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const result = await appointmentService.update('appt-1', {
      reminder: {
        channel: 'WHATSAPP',
        to: '+15551234567',
        sendMode: 'IMMEDIATE',
      },
    } as any, 'user-1');

    expect(tx.reminder.create).toHaveBeenCalled();
    expect(tx.appointment.update).toHaveBeenCalled();
  });

  it('cancels existing reminder when sending null', async () => {
    const apptWithReminder = {
      ...existingAppt,
      reminderId: 'reminder-1',
      reminder: { id: 'reminder-1', status: 'PENDING', contentVariables: {} },
    };
    mockPrisma.appointment.findFirst.mockResolvedValue(apptWithReminder as any);

    const tx = mockTx();
    tx.appointment.update.mockResolvedValue({ ...apptWithReminder, reminderId: null } as any);
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    await appointmentService.update('appt-1', { reminder: null } as any, 'user-1');

    expect(tx.reminder.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'reminder-1' },
      data: { status: 'CANCELLED' },
    }));
    expect(tx.appointment.update).toHaveBeenCalled();
  });

  it('throws when trying to cancel non-PENDING reminder', async () => {
    const apptWithSentReminder = {
      ...existingAppt,
      reminderId: 'reminder-1',
      reminder: { id: 'reminder-1', status: 'SENT', contentVariables: {} },
    };
    mockPrisma.appointment.findFirst.mockResolvedValue(apptWithSentReminder as any);

    const tx = mockTx();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    await expect(
      appointmentService.update('appt-1', { reminder: null } as any, 'user-1')
    ).rejects.toThrow();
  });

  it('updates existing reminder fields', async () => {
    const apptWithReminder = {
      ...existingAppt,
      reminderId: 'reminder-1',
      reminder: { id: 'reminder-1', status: 'PENDING', contentVariables: { '1': 'old' } },
    };
    mockPrisma.appointment.findFirst.mockResolvedValue(apptWithReminder as any);

    const tx = mockTx();
    tx.appointment.update.mockResolvedValue(apptWithReminder as any);
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    await appointmentService.update('appt-1', {
      reminder: {
        channel: 'SMS',
        to: '+15559876543',
        sendMode: 'IMMEDIATE',
      },
    } as any, 'user-1');

    expect(tx.reminder.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'reminder-1' },
      data: expect.objectContaining({ channel: 'SMS', to: '+15559876543' }),
    }));
  });
});
