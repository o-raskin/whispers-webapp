import { getHttpBaseUrl } from '../api/apiClient'
import type { AuthSession, PendingAuthRedirect } from '../types/auth'

const AUTH_SESSION_STORAGE_PREFIX = 'whispers-auth-session:'
const AUTH_PENDING_PROVIDER_STORAGE_KEY = 'whispers-auth-pending-provider'
const AUTH_PENDING_REDIRECT_STORAGE_KEY = 'whispers-auth-pending-redirect'

function getAuthSessionStorageKey(serverUrl: string) {
  return `${AUTH_SESSION_STORAGE_PREFIX}${getHttpBaseUrl(serverUrl)}`
}

export function loadStoredAuthSession(serverUrl: string): AuthSession | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(getAuthSessionStorageKey(serverUrl))

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as AuthSession

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.tokenType !== 'string' ||
      typeof parsed.provider !== 'string' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function saveAuthSession(serverUrl: string, session: AuthSession) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(getAuthSessionStorageKey(serverUrl), JSON.stringify(session))
}

export function clearStoredAuthSession(serverUrl: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(getAuthSessionStorageKey(serverUrl))
}

export function loadPendingAuthProvider() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.sessionStorage.getItem(AUTH_PENDING_PROVIDER_STORAGE_KEY)
}

export function savePendingAuthProvider(provider: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(AUTH_PENDING_PROVIDER_STORAGE_KEY, provider)
}

export function clearPendingAuthProvider() {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.removeItem(AUTH_PENDING_PROVIDER_STORAGE_KEY)
}

export function loadPendingAuthRedirect(): PendingAuthRedirect | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(AUTH_PENDING_REDIRECT_STORAGE_KEY)

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as PendingAuthRedirect

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.provider !== 'string' ||
      typeof parsed.state !== 'string' ||
      typeof parsed.nonce !== 'string' ||
      typeof parsed.codeVerifier !== 'string' ||
      typeof parsed.createdAt !== 'number'
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function savePendingAuthRedirect(payload: PendingAuthRedirect) {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(AUTH_PENDING_REDIRECT_STORAGE_KEY, JSON.stringify(payload))
}

export function clearPendingAuthRedirect() {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.removeItem(AUTH_PENDING_REDIRECT_STORAGE_KEY)
}
