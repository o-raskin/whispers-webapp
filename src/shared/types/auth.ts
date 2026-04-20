export interface OAuthLoginRequest {
  code: string
  redirectUri: string
  codeVerifier: string
  nonce: string
}

export interface AuthUserProfile {
  userId: string
  username: string
  email: string
  displayName?: string
  firstName?: string
  lastName?: string
  pictureUrl?: string
  provider?: string | null
}

export interface LoginResponse {
  accessToken: string
  tokenType: string
  expiresInSeconds: number
  user: AuthUserProfile
}

export interface LogoutResponse {
  status: string
  redirectUri: string
}

export interface AuthSession {
  accessToken: string
  tokenType: string
  expiresAt: number
  provider: string
}

export interface AuthProviderOption {
  id: string
  label: string
}

export interface PendingAuthRedirect {
  codeVerifier: string
  createdAt: number
  nonce: string
  provider: string
  state: string
}
