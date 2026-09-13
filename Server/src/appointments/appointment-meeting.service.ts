import { logger } from '../utils/api/logger.ts';
import { AppointmentMeetingUrlRequiredError } from './appointment.errors.ts';

export const appointmentMeetingService = {
  resolveMeetingUrl(params: {
    location: { isVirtual: boolean } | null;
    previousLocation?: { isVirtual: boolean } | null;
    existingUrl: string | null;
    desiredUrl?: string | null | undefined;
    appointmentId: string;
  }): string | null | undefined {
    const { location, previousLocation, existingUrl, desiredUrl, appointmentId } = params;
    const isVirtual = location?.isVirtual ?? false;

    if (previousLocation?.isVirtual && !isVirtual) {
      logger.info({ appointmentId }, 'Cleared meeting URL (switched to in-person)');
      return null;
    }

    if (desiredUrl === '' || desiredUrl === null) {
      if (isVirtual) throw new AppointmentMeetingUrlRequiredError();
      logger.info({ appointmentId }, 'Cleared meeting URL (explicit)');
      return null;
    }

    if (desiredUrl !== undefined) {
      logger.info({ appointmentId }, 'Using provided meeting URL');
      return desiredUrl;
    }

    if (!existingUrl && isVirtual) throw new AppointmentMeetingUrlRequiredError();
    return existingUrl ?? undefined;
  },
};
