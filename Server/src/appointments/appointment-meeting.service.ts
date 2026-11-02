import { MeetingStatus } from '../../generated/prisma/enums.ts';
import { logger } from '../utils/api/logger.ts';
import { AppointmentMeetingUrlRequiredError } from './appointment.errors.ts';

/** How a portal booking at a virtual location gets its link: the `provision-meet` job, or the provider by hand. */
export type MeetingPending = 'auto' | 'manual';

/** Statuses of a virtual appointment that is allowed to have no link yet. */
export const WAITING_FOR_LINK: ReadonlySet<MeetingStatus> = new Set([ MeetingStatus.PENDING, MeetingStatus.NEEDS_LINK ]);

export interface ResolvedMeeting {
  /** `undefined` leaves the stored URL unchanged. */
  meetingUrl: string | null | undefined;
  meetingStatus: MeetingStatus;
}

export const appointmentMeetingService = {
  /**
   * The meeting URL and status an appointment ends up with. In person → `NOT_REQUIRED`; virtual with a URL →
   * `READY`. A virtual appointment may lack a URL only when the portal creates it (`pending`) or while it is still
   * waiting for one (`PENDING`/`NEEDS_LINK`); every other virtual appointment needs a URL, so the provider path is
   * unchanged.
   */
  resolveMeeting(params: {
    location: { isVirtual: boolean } | null;
    previousLocation?: { isVirtual: boolean } | null;
    existingUrl: string | null;
    existingStatus?: MeetingStatus;
    desiredUrl?: string | null | undefined;
    /** Create only (portal booking): allow a virtual appointment without a URL. */
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

    // No URL (none stored, or an explicit clear): only a portal booking or an appointment still waiting may go without.
    if (waiting) return { meetingUrl: undefined, meetingStatus: existingStatus };
    if (pending && !existingUrl) {
      return { meetingUrl: null, meetingStatus: pending === 'auto' ? MeetingStatus.PENDING : MeetingStatus.NEEDS_LINK };
    }
    throw new AppointmentMeetingUrlRequiredError();
  },
};
