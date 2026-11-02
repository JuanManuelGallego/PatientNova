export type GoogleConnectionState = "connected" | "expired" | "not_connected";

export interface GoogleConnectionStatus {
  status: GoogleConnectionState;
  connected: boolean;
  connectedAt?: string | null;
  lastUsedAt?: string | null;
  lastCheckedAt?: string | null;
  disconnectedAt?: string | null;
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
