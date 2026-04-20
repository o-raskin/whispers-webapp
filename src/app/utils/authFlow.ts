import {
  AUTH_CALLBACK_PARAM,
  AUTH_CALLBACK_ROUTE_PREFIX,
  AUTH_PROVIDERS,
  AUTH_STATE_PARAM,
} from '../../shared/config/auth'
import { loadPendingAuthProvider } from '../../shared/auth/authStorage'
import type { AuthSession, AuthUserProfile, LoginResponse } from '../../shared/types/auth'

export type AuthStatus =
  | 'authenticated'
  | 'authenticating'
  | 'checking'
  | 'unauthenticated'

export function createSessionFromLogin(payload: LoginResponse, provider: string): AuthSession {
  return {
    accessToken: payload.accessToken,
    tokenType: payload.tokenType,
    expiresAt: Date.now() + payload.expiresInSeconds * 1000,
    provider,
  }
}

export function replaceBrowserRoute(pathname: string) {
  if (typeof window === 'undefined') {
    return
  }

  const nextUrl = new URL(window.location.href)
  nextUrl.pathname = pathname
  nextUrl.search = ''
  nextUrl.hash = ''
  window.history.replaceState({}, '', nextUrl)
}

export function getAuthCallbackCode() {
  if (typeof window === 'undefined') {
    return ''
  }

  return new URLSearchParams(window.location.search).get(AUTH_CALLBACK_PARAM)?.trim() ?? ''
}

export function getAuthCallbackState() {
  if (typeof window === 'undefined') {
    return ''
  }

  return new URLSearchParams(window.location.search).get(AUTH_STATE_PARAM)?.trim() ?? ''
}

export function getAuthCallbackProvider(selectedProvider: string) {
  if (typeof window === 'undefined') {
    return selectedProvider
  }

  const callbackPath = window.location.pathname

  if (callbackPath.startsWith(`${AUTH_CALLBACK_ROUTE_PREFIX}/`)) {
    const provider = callbackPath
      .slice(`${AUTH_CALLBACK_ROUTE_PREFIX}/`.length)
      .split('/')[0]

    if (provider) {
      return provider
    }
  }

  return (
    loadPendingAuthProvider() ??
    (AUTH_PROVIDERS.length === 1 ? AUTH_PROVIDERS[0].id : selectedProvider)
  )
}

export function getCurrentUserLabel(user: AuthUserProfile | null) {
  if (!user) {
    return ''
  }

  return user.displayName?.trim() || user.email || user.username
}

export function getProviderLabel(providerId: string) {
  return AUTH_PROVIDERS.find((provider) => provider.id === providerId)?.label ?? providerId
}
