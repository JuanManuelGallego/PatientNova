import { SpacesServiceClient } from '@google-apps/meet';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../utils/config';

export interface MeetingSpaceResult {
    meetingUrl: string; 
    spaceName: string;
}

function buildUserMeetClient(): SpacesServiceClient {
    const oauth2Client = new OAuth2Client(
        config.google.clientId,
        config.google.clientSecret
    );

    oauth2Client.setCredentials({
        refresh_token: config.google.refreshToken,
    });

    return new SpacesServiceClient({ 
        authClient: oauth2Client 
    });
}

export const googleMeetService = {
    /**
     * Creates a new Google Meet space and returns its join URL.
     */
    async createMeetingSpace(): Promise<MeetingSpaceResult> {
        const client = buildUserMeetClient();

        const [ space ] = await client.createSpace({
            space: {
                config: {
                    accessType: 'OPEN'
                }
            }
        });
        const meetingUrl = space.meetingUri;
        const spaceName = space.name;

        if (!meetingUrl || !spaceName) {
            throw new Error(
                'Google Meet API returned an incomplete space object. ' +
                'Verify the Meet API is enabled and the service account has the correct scope.',
            );
        }

        return { meetingUrl, spaceName };
    },

    /**
     * Ends an active conference within a space (if one is in progress).
     * The space itself persists — the meeting URL remains valid for future use.
     *
     * Call this on appointment cancellation if you want to boot active participants.
     */
    async endActiveConference(meetingUrl: string): Promise<void> {
        const meetingCode = meetingUrl.split('/').pop();
        const client = buildUserMeetClient();
        await client.endActiveConference({ name: `spaces/${meetingCode}` });
    }
};
