import type { AuthProviderOption } from '../types/auth'

export const LOGIN_ROUTE_PATH = '/login'
export const AUTH_CALLBACK_ROUTE_PREFIX = '/auth/callback'
export const HOME_ROUTE_PATH = '/'
export const AUTH_CALLBACK_PARAM = 'code'
export const AUTH_STATE_PARAM = 'state'
export const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_DEFAULT_SCOPES = ['openid', 'email', 'profile']

export const AUTH_PROVIDERS: AuthProviderOption[] = [
  {
    id: 'google',
    label: 'Google',
  },
]

export const DEFAULT_AUTH_PROVIDER = AUTH_PROVIDERS[0]?.id ?? 'google'

function parseConfiguredScopes(rawValue: string | undefined) {
  return rawValue
    ?.split(/[,\s]+/u)
    .map((value) => value.trim())
    .filter(Boolean) ?? []
}

export function getGoogleOAuthClientId() {
  return import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim() ?? ''
}

export function getGoogleOAuthScopes() {
  const configuredScopes = parseConfiguredScopes(import.meta.env.VITE_GOOGLE_OAUTH_SCOPES)
  return configuredScopes.length > 0 ? configuredScopes : GOOGLE_DEFAULT_SCOPES
}

export function getAuthCallbackPath(provider: string) {
  return `${AUTH_CALLBACK_ROUTE_PREFIX}/${provider}`
}

export function getAuthCallbackRedirectUri(provider: string) {
  if (typeof window === 'undefined') {
    return `http://localhost${getAuthCallbackPath(provider)}`
  }

  return new URL(getAuthCallbackPath(provider), window.location.origin).toString()
}

export function isProviderRedirectConfigured(provider: string) {
  if (provider !== 'google') {
    return false
  }

  return Boolean(getGoogleOAuthClientId())
}

export function buildProviderAuthorizationUrl(
  provider: string,
  options: {
    codeChallenge: string
    nonce: string
    redirectUri: string
    state: string
  },
) {
  if (provider !== 'google') {
    return null
  }

  const clientId = getGoogleOAuthClientId()

  if (!clientId) {
    return null
  }

  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', options.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', getGoogleOAuthScopes().join(' '))
  url.searchParams.set('state', options.state)
  url.searchParams.set('nonce', options.nonce)
  url.searchParams.set('code_challenge', options.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')

  return url.toString()
}
