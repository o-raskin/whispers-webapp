import {
  buildJsonHeaders,
  buildUrl,
  parseJsonResponse,
} from './apiClient'
import type {
  AuthUserProfile,
  LoginResponse,
  LogoutResponse,
  OAuthLoginRequest,
} from '../types/auth'

type AuthUserProfilePayload = AuthUserProfile & {
  first_name?: string
  imageUrl?: string
  last_name?: string
  picture?: string
  pictureURL?: string
  picture_url?: string
}

type LoginResponsePayload = Omit<LoginResponse, 'user'> & {
  user: AuthUserProfilePayload
}

function getTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function pickFirstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = getTrimmedString(value)

    if (normalized) {
      return normalized
    }
  }

  return undefined
}

function normalizeAuthUserProfile(payload: AuthUserProfilePayload): AuthUserProfile {
  return {
    userId: payload.userId,
    username: payload.username,
    email: payload.email,
    displayName: pickFirstString(payload.displayName),
    firstName: pickFirstString(payload.firstName, payload.first_name),
    lastName: pickFirstString(payload.lastName, payload.last_name),
    pictureUrl: pickFirstString(
      payload.pictureUrl,
      payload.pictureURL,
      payload.picture_url,
      payload.picture,
      payload.imageUrl,
    ),
    provider: payload.provider ?? null,
  }
}

function normalizeLoginResponse(payload: LoginResponsePayload): LoginResponse {
  return {
    ...payload,
    user: normalizeAuthUserProfile(payload.user),
  }
}

export async function loginWithProvider(
  serverUrl: string,
  provider: string,
  payload: OAuthLoginRequest,
): Promise<LoginResponse> {
  const response = await fetch(buildUrl(serverUrl, `/auth/${provider}/login`), {
    method: 'POST',
    headers: buildJsonHeaders(undefined, { contentType: 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(payload),
  })

  const responsePayload = await parseJsonResponse<LoginResponsePayload>(
    response,
    'Authentication failed.',
  )

  return normalizeLoginResponse(responsePayload)
}

export async function refreshSession(serverUrl: string): Promise<LoginResponse> {
  const response = await fetch(buildUrl(serverUrl, '/auth/refresh'), {
    method: 'POST',
    headers: buildJsonHeaders(),
    credentials: 'include',
  })

  const responsePayload = await parseJsonResponse<LoginResponsePayload>(
    response,
    'Session refresh failed.',
  )

  return normalizeLoginResponse(responsePayload)
}

export async function fetchCurrentUser(
  serverUrl: string,
  accessToken: string,
): Promise<AuthUserProfile> {
  const response = await fetch(buildUrl(serverUrl, '/auth/me'), {
    headers: buildJsonHeaders(accessToken),
    credentials: 'include',
  })

  const responsePayload = await parseJsonResponse<AuthUserProfilePayload>(
    response,
    'Cannot load current user.',
  )

  return normalizeAuthUserProfile(responsePayload)
}

export async function logoutCurrentSession(
  serverUrl: string,
  accessToken: string,
): Promise<LogoutResponse> {
  const response = await fetch(buildUrl(serverUrl, '/auth/logout'), {
    method: 'POST',
    headers: buildJsonHeaders(accessToken),
    credentials: 'include',
  })

  return parseJsonResponse<LogoutResponse>(response, 'Logout failed.')
}
