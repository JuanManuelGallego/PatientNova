import { MeetingStatus } from '../../generated/prisma/enums.ts';
import { logger } from '../utils/api/logger.ts';
import { AppointmentMeetingUrlRequiredError } from './appointment.errors.ts';

export type MeetingPending = 'auto' | 'manual';

export const WAITING_FOR_LINK: ReadonlySet<MeetingStatus> = new Set([ MeetingStatus.PENDING, MeetingStatus.NEEDS_LINK ]);

export interface ResolvedMeeting {
  meetingUrl: string | null | undefined;
  meetingStatus: MeetingStatus;
}

export const appointmentMeetingService = {
  resolveMeeting(params: {
    location: { isVirtual: boolean } | null;
    previousLocation?: { isVirtual: boolean } | null;
    existingUrl: string | null;
    existingStatus?: MeetingStatus;
    desiredUrl?: string | null | undefined;
    pending?: MeetingPending;
    appointmentId: string;
  }): ResolvedMeeting {
    const { location, previousLocation, existingUrl, desiredUrl, pending, appointmentId } = params;
    const existingStatus = params.existingStatus ?? MeetingStatus.NOT_REQUIRED;
    const isVirtual = location?.isVirtual ?? false;
    const waiting = isVirtual && WAITING_FOR_LINK.has(existingStatus);

    if (previousLocation?.isVirtual && !isVirtual) {
      logger.info({ appointmentId }, 'Cleared meeting URL (switched to in-person)');
      return { meetingUrl: null, meetingStatus: MeetingStatus.NOT_REQUIRED };
    }

    if (!isVirtual) {
      if (desiredUrl === '' || desiredUrl === null) {
        logger.info({ appointmentId }, 'Cleared meeting URL (explicit)');
        return { meetingUrl: null, meetingStatus: MeetingStatus.NOT_REQUIRED };
      }
      return { meetingUrl: desiredUrl ?? existingUrl ?? undefined, meetingStatus: MeetingStatus.NOT_REQUIRED };
    }

    if (desiredUrl) {
      logger.info({ appointmentId }, 'Using provided meeting URL');
      return { meetingUrl: desiredUrl, meetingStatus: MeetingStatus.READY };
    }

    if (desiredUrl === undefined && existingUrl) return { meetingUrl: existingUrl, meetingStatus: MeetingStatus.READY };

    if (waiting) return { meetingUrl: undefined, meetingStatus: existingStatus };
    if (pending && !existingUrl) {
      return { meetingUrl: null, meetingStatus: pending === 'auto' ? MeetingStatus.PENDING : MeetingStatus.NEEDS_LINK };
    }
    throw new AppointmentMeetingUrlRequiredError();
  },
};
