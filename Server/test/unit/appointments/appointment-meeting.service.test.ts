import { describe, expect, it } from 'vitest';
import { MeetingStatus } from '../../../generated/prisma/enums.ts';
import { appointmentMeetingService } from '../../../src/appointments/appointment-meeting.service.ts';
import { AppointmentMeetingUrlRequiredError } from '../../../src/appointments/appointment.errors.ts';

const resolve = appointmentMeetingService.resolveMeeting;
const virtual = { isVirtual: true };
const inPerson = { isVirtual: false };
const base = { appointmentId: 'appointment-1' };

describe('appointmentMeetingService.resolveMeeting', () => {
  it.each([ null, '' ])('treats %j as an explicit clear in person', (desiredUrl) => {
    expect(resolve({ ...base, location: inPerson, existingUrl: 'https://old.test', desiredUrl }))
      .toEqual({ meetingUrl: null, meetingStatus: MeetingStatus.NOT_REQUIRED });
  });

  it.each([ null, '', undefined ])('rejects a virtual appointment without a URL (%j) on the provider path', (desiredUrl) => {
    expect(() => resolve({ ...base, location: virtual, existingUrl: null, desiredUrl })).toThrow(AppointmentMeetingUrlRequiredError);
  });

  it('keeps a virtual URL when no change is requested, as READY', () => {
    expect(resolve({ ...base, location: virtual, existingUrl: 'https://meet.google.com/existing', existingStatus: MeetingStatus.READY }))
      .toEqual({ meetingUrl: 'https://meet.google.com/existing', meetingStatus: MeetingStatus.READY });
  });

  it('refuses clearing a READY link', () => {
    expect(() => resolve({
      ...base, location: virtual, existingUrl: 'https://meet.google.com/x', existingStatus: MeetingStatus.READY, desiredUrl: '',
    })).toThrow(AppointmentMeetingUrlRequiredError);
  });

  it('clears the URL when switching to in-person even if another URL is supplied', () => {
    expect(resolve({
      ...base,
      location: inPerson,
      previousLocation: virtual,
      existingUrl: 'https://meet.google.com/existing',
      existingStatus: MeetingStatus.READY,
      desiredUrl: 'https://meet.google.com/replacement',
    })).toEqual({ meetingUrl: null, meetingStatus: MeetingStatus.NOT_REQUIRED });
  });

  it('lets a portal booking create a virtual appointment without a URL', () => {
    expect(resolve({ ...base, location: virtual, existingUrl: null, pending: 'auto' }))
      .toEqual({ meetingUrl: null, meetingStatus: MeetingStatus.PENDING });
    expect(resolve({ ...base, location: virtual, existingUrl: null, pending: 'manual' }))
      .toEqual({ meetingUrl: null, meetingStatus: MeetingStatus.NEEDS_LINK });
  });

  it('a portal booking with a URL is READY; an in-person one ignores pending', () => {
    expect(resolve({ ...base, location: virtual, existingUrl: null, pending: 'auto', desiredUrl: 'https://x.test' }))
      .toEqual({ meetingUrl: 'https://x.test', meetingStatus: MeetingStatus.READY });
    expect(resolve({ ...base, location: inPerson, existingUrl: null, pending: 'auto' }))
      .toEqual({ meetingUrl: undefined, meetingStatus: MeetingStatus.NOT_REQUIRED });
  });

  it.each([ MeetingStatus.PENDING, MeetingStatus.NEEDS_LINK ])('keeps %s while other fields change or the URL is cleared', (status) => {
    for (const desiredUrl of [ undefined, '', null ]) {
      expect(resolve({ ...base, location: virtual, existingUrl: null, existingStatus: status, desiredUrl }))
        .toEqual({ meetingUrl: undefined, meetingStatus: status });
    }
  });

  it.each([ MeetingStatus.PENDING, MeetingStatus.NEEDS_LINK ])('a link added to a %s appointment makes it READY', (status) => {
    expect(resolve({ ...base, location: virtual, existingUrl: null, existingStatus: status, desiredUrl: 'https://zoom.test/j/1' }))
      .toEqual({ meetingUrl: 'https://zoom.test/j/1', meetingStatus: MeetingStatus.READY });
  });

  it('a provider switching an in-person appointment to virtual still needs a URL', () => {
    expect(() => resolve({
      ...base, location: virtual, previousLocation: inPerson, existingUrl: null, existingStatus: MeetingStatus.NOT_REQUIRED,
    })).toThrow(AppointmentMeetingUrlRequiredError);
  });
});
