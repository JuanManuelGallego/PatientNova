import { describe, expect, it } from 'vitest';
import { appointmentMeetingService } from '../../../src/appointments/appointment-meeting.service.ts';
import { AppointmentMeetingUrlRequiredError } from '../../../src/appointments/appointment.errors.ts';

describe('appointmentMeetingService.resolveMeetingUrl', () => {
  it.each([null, ''])('treats %j as an explicit clear', (desiredUrl) => {
    expect(appointmentMeetingService.resolveMeetingUrl({
      location: { isVirtual: false },
      existingUrl: 'https://old.test',
      desiredUrl,
      appointmentId: 'appointment-1',
    })).toBeNull();
  });

  it.each([null, '', undefined])('rejects final virtual URL %j', (desiredUrl) => {
    expect(() => appointmentMeetingService.resolveMeetingUrl({
      location: { isVirtual: true },
      existingUrl: null,
      desiredUrl,
      appointmentId: 'appointment-1',
    })).toThrow(AppointmentMeetingUrlRequiredError);
  });

  it('preserves a virtual URL when no change is requested', () => {
    expect(appointmentMeetingService.resolveMeetingUrl({
      location: { isVirtual: true },
      existingUrl: 'https://meet.google.com/existing',
      appointmentId: 'appointment-1',
    })).toBe('https://meet.google.com/existing');
  });

  it('clears the URL when switching to in-person even if another URL is supplied', () => {
    expect(appointmentMeetingService.resolveMeetingUrl({
      location: { isVirtual: false },
      previousLocation: { isVirtual: true },
      existingUrl: 'https://meet.google.com/existing',
      desiredUrl: 'https://meet.google.com/replacement',
      appointmentId: 'appointment-1',
    })).toBeNull();
  });
});
