import { Prisma } from '../../generated/prisma/client.ts';
import { googleMeetService } from '../google-meet/google-meet.service.ts';
import { logger } from '../utils/api/logger.ts';
import type { TransactionClient } from '../utils/prisma/prisma-client.ts';

const MEETING_URL_VAR_KEY = '5';

export const appointmentMeetingService = {
  async resolveMeetingUrl(
    params: {
      location: { isVirtual: boolean } | null;
      existingUrl: string | null;
      desiredUrl?: string | null | undefined;
      reminder: { id: string; contentVariables: Prisma.JsonValue | null } | null;
      appointmentId: string;
    },
    client: TransactionClient,
  ): Promise<string | undefined> {
    const { location, existingUrl, desiredUrl, reminder, appointmentId } = params;
    const isVirtual = location?.isVirtual ?? false;

    const clearReminderVar = async () => {
      if (!reminder) return;
      const vars = { ...(reminder.contentVariables as Record<string, string>) };
      delete vars[MEETING_URL_VAR_KEY];
      await client.reminder.update({
        where: { id: reminder.id },
        data: { contentVariables: vars },
      });
    };

    const setReminderVar = async (url: string) => {
      if (!reminder) return;
      await client.reminder.update({
        where: { id: reminder.id },
        data: {
          contentVariables: {
            ...(reminder.contentVariables as Record<string, string>),
            [MEETING_URL_VAR_KEY]: url,
          },
        },
      });
    };

    // Explicit clear requested (empty string from client)
    if (desiredUrl === '') {
      logger.info({ appointmentId }, 'Cleared meeting URL (explicit)');
      await clearReminderVar();
      return undefined;
    }

    // Explicit value provided by client
    if (desiredUrl) {
      logger.info({ appointmentId, meetingUrl: desiredUrl }, 'Using provided meeting URL');
      await setReminderVar(desiredUrl);
      return desiredUrl;
    }

    // No explicit value: auto behavior
    if (!existingUrl && isVirtual) {
      const space = await googleMeetService.createMeetingSpace();
      const meetingUrl = space.meetingUrl;
      logger.info({ appointmentId, meetingUrl }, 'Generated meeting URL for virtual appointment');
      await setReminderVar(meetingUrl);
      return meetingUrl;
    }

    if (location && !isVirtual && existingUrl) {
      logger.info({ appointmentId }, 'Cleared meeting URL (switched to in-person)');
      await clearReminderVar();
      return undefined;
    }

    return existingUrl ?? undefined;
  },
};
