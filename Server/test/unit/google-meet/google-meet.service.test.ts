import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/config/config.js', () => ({
  config: {
    google: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      refreshToken: 'test-refresh-token',
    },
  },
}));

vi.mock('../../../src/utils/api/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockCreateSpace = vi.fn();
const mockEndActiveConference = vi.fn();
const mockSetCredentials = vi.fn();

vi.mock('@google-apps/meet', () => ({
  SpacesServiceClient: class {
    createSpace = mockCreateSpace;
    endActiveConference = mockEndActiveConference;
  },
}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    setCredentials = mockSetCredentials;
  },
}));

import { googleMeetService } from '../../../src/google-meet/google-meet.service.js';

beforeEach(() => vi.clearAllMocks());

describe('googleMeetService.createMeetingSpace', () => {
  it('creates a meeting space and returns URL and name', async () => {
    mockCreateSpace.mockResolvedValue([{
      meetingUri: 'https://meet.google.com/abc-defg-hij',
      name: 'spaces/abc-defg-hij',
    }]);

    const result = await googleMeetService.createMeetingSpace();

    expect(result).toEqual({
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      spaceName: 'spaces/abc-defg-hij',
    });
    expect(mockCreateSpace).toHaveBeenCalledWith({
      space: { config: { accessType: 'OPEN' } },
    });
  });

  it('throws when meeting URL is missing from response', async () => {
    mockCreateSpace.mockResolvedValue([{
      meetingUri: null,
      name: 'spaces/abc',
    }]);

    await expect(googleMeetService.createMeetingSpace()).rejects.toThrow('Failed to create Google Meet space');
  });

  it('throws when space name is missing from response', async () => {
    mockCreateSpace.mockResolvedValue([{
      meetingUri: 'https://meet.google.com/abc-defg-hij',
      name: null,
    }]);

    await expect(googleMeetService.createMeetingSpace()).rejects.toThrow('Failed to create Google Meet space');
  });

  it('throws when createSpace returns null element', async () => {
    mockCreateSpace.mockResolvedValue([null]);

    await expect(googleMeetService.createMeetingSpace()).rejects.toThrow('Failed to create Google Meet space');
  });

  it('wraps API errors in a descriptive error', async () => {
    mockCreateSpace.mockRejectedValue(new Error('API quota exceeded'));

    await expect(googleMeetService.createMeetingSpace()).rejects.toThrow('Failed to create Google Meet space');
  });
});

describe('googleMeetService.endActiveConference', () => {
  it('ends the active conference for a given meeting URL', async () => {
    mockEndActiveConference.mockResolvedValue(undefined);

    await googleMeetService.endActiveConference('https://meet.google.com/abc-defg-hij');

    expect(mockEndActiveConference).toHaveBeenCalledWith({
      name: 'spaces/abc-defg-hij',
    });
  });

  it('rethrows API errors', async () => {
    mockEndActiveConference.mockRejectedValue(new Error('Conference not found'));

    await expect(
      googleMeetService.endActiveConference('https://meet.google.com/abc-defg-hij')
    ).rejects.toThrow('Conference not found');
  });

  it('throws on malformed URL with no slashes', async () => {
    await expect(
      googleMeetService.endActiveConference('malformed-url-no-slashes')
    ).rejects.toThrow('Invalid Google Meet URL');
  });

  it('throws on empty meeting code', async () => {
    await expect(
      googleMeetService.endActiveConference('https://meet.google.com/')
    ).rejects.toThrow('Invalid Google Meet URL');
  });
});
