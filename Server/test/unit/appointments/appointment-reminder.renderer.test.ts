import { describe, expect, it } from 'vitest';
import { renderAppointmentReminder } from '../../../src/appointments/appointment-reminder.renderer.ts';
import type { AppointmentWithRelations } from '../../../src/appointments/appointment.types.ts';

function appointment(overrides: Record<string, unknown> = {}): AppointmentWithRelations {
  return {
    id: 'appointment-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    startAt: new Date('2026-10-20T15:30:00.000Z'),
    endAt: new Date('2026-10-20T16:30:00.000Z'),
    timezone: 'America/Bogota',
    price: 100,
    currency: 'COP',
    paid: false,
    meetingUrl: 'https://meet.google.com/final-room',
    notes: null,
    status: 'SCHEDULED',
    confirmedAt: null,
    cancelledAt: null,
    completedAt: null,
    isDeleted: false,
    deletedAt: null,
    patientId: 'patient-1',
    userId: 'user-1',
    reminderId: 'reminder-1',
    locationId: 'location-1',
    typeId: 'type-1',
    patient: { id: 'patient-1', name: 'Ana', lastName: 'Diaz', email: null },
    reminder: {
      id: 'reminder-1',
      channel: 'WHATSAPP',
      status: 'PENDING',
      sendMode: 'SCHEDULED',
      sendAt: new Date(),
      contentSid: 'HXstale',
      contentVariables: { '5': 'https://old.test' },
      body: 'stale',
      patientId: 'patient-1',
      userId: 'user-1',
      appointmentId: 'appointment-1',
    },
    appointmentLocation: {
      id: 'location-1', name: 'Virtual', address: null, instructions: null,
      color: null, defaultPrice: null, isVirtual: true,
    },
    appointmentType: {
      id: 'type-1', name: 'Consulta', description: null, defaultDuration: 60,
      defaultPrice: null, color: null,
    },
    ...overrides,
  } as AppointmentWithRelations;
}

describe('renderAppointmentReminder', () => {
  it('replaces the complete WhatsApp payload from canonical virtual data', () => {
    const rendered = renderAppointmentReminder(appointment(), 'Dra. Rivera');
    expect(rendered).toEqual({
      contentSid: 'HX4a988ec65d4afaec679c99b3ac218517',
      contentVariables: {
        '1': 'Ana',
        '2': 'Dra. Rivera',
        '3': '20 de octubre de 2026',
        '4': '10:30 a. m.',
        '5': 'https://meet.google.com/final-room',
      },
      body: null,
    });
  });

  it('renders an in-person SMS body without a stale virtual URL', () => {
    const rendered = renderAppointmentReminder(appointment({
      meetingUrl: null,
      reminder: { ...appointment().reminder, channel: 'SMS' },
      appointmentLocation: {
        ...appointment().appointmentLocation,
        isVirtual: false,
        address: 'Calle 1',
        instructions: 'Piso 2',
      },
    }), 'Dra. Rivera');

    expect(rendered?.contentSid).toBeNull();
    expect(rendered?.body).toContain('Dirección: Calle 1');
    expect(rendered?.body).toContain('Instrucciones: Piso 2');
    expect(rendered?.body).not.toContain('final-room');
  });
});
