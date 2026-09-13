export interface GoogleConnectionStatus {
  connected: boolean;
  connectedAt?: string;
  lastUsedAt?: string;
}

export interface GoogleOAuthStartResponse {
  authUrl: string;
}

export interface GoogleMeetCreateResponse {
  meetingUrl: string;
  spaceName: string;
}

export interface GoogleDisconnectResponse {
  success: boolean;
}

export interface OAuthCompletionResult {
  success: boolean;
  returnPath?: string;
  error?: string;
}
