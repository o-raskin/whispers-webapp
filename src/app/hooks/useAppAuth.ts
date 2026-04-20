import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react'
import {
  fetchCurrentUser,
  loginWithProvider,
  refreshSession,
} from '../../shared/api/authApi'
import { ApiError } from '../../shared/api/apiClient'
import {
  clearPendingAuthRedirect,
  clearPendingAuthProvider,
  clearStoredAuthSession,
  loadPendingAuthProvider,
  loadPendingAuthRedirect,
  loadStoredAuthSession,
  saveAuthSession,
  savePendingAuthRedirect,
  savePendingAuthProvider,
} from '../../shared/auth/authStorage'
import {
  createOAuthState,
  createOidcNonce,
  createPkcePair,
} from '../../shared/auth/oauthRedirect'
import {
  AUTH_CALLBACK_ROUTE_PREFIX,
  DEFAULT_AUTH_PROVIDER,
  HOME_ROUTE_PATH,
  LOGIN_ROUTE_PATH,
  buildProviderAuthorizationUrl,
  getAuthCallbackRedirectUri,
  isProviderRedirectConfigured,
} from '../../shared/config/auth'
import type { AuthSession, AuthUserProfile } from '../../shared/types/auth'
import {
  type AuthStatus,
  createSessionFromLogin,
  getAuthCallbackCode,
  getAuthCallbackProvider,
  getAuthCallbackState,
  getCurrentUserLabel,
  getProviderLabel,
  replaceBrowserRoute,
} from '../utils/authFlow'

interface UseAppAuthArgs {
  appendEventLog: (message: string) => void
  connectAuthenticatedSocketRef: MutableRefObject<
    (accessToken: string, username: string) => void
  >
  serverUrl: string
}

interface UseAppAuthResult {
  authError: string | null
  authSession: AuthSession | null
  authStatus: AuthStatus
  authUser: AuthUserProfile | null
  clearAuthState: (errorMessage?: string | null) => void
  currentUserLabel: string
  handleStartProviderLogin: () => Promise<void>
  providerRedirectEnabled: boolean
  selectedProviderLabel: string
  setAuthError: Dispatch<SetStateAction<string | null>>
}

export function useAppAuth({
  appendEventLog,
  connectAuthenticatedSocketRef,
  serverUrl,
}: UseAppAuthArgs): UseAppAuthResult {
  const applyAuthenticatedSessionRef = useRef<(session: AuthSession, user: AuthUserProfile) => void>(
    () => {},
  )
  const authenticateRef = useRef<
    (
      provider: string,
      code: string,
      options?: { codeVerifier?: string; nonce?: string },
    ) => Promise<void>
  >(async () => {})

  const [selectedProvider, setSelectedProvider] = useState(DEFAULT_AUTH_PROVIDER)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authSession, setAuthSession] = useState<AuthSession | null>(null)
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking')
  const [authUser, setAuthUser] = useState<AuthUserProfile | null>(null)

  const clearAuthState = useCallback((errorMessage: string | null = null) => {
    clearStoredAuthSession(serverUrl)
    clearPendingAuthRedirect()
    clearPendingAuthProvider()
    setAuthSession(null)
    setAuthUser(null)
    setAuthStatus('unauthenticated')
    setAuthError(errorMessage)
  }, [serverUrl])

  const applyAuthenticatedSession = useCallback((session: AuthSession, user: AuthUserProfile) => {
    saveAuthSession(serverUrl, session)
    clearPendingAuthRedirect()
    clearPendingAuthProvider()
    setAuthSession(session)
    setAuthUser(user)
    setSelectedProvider(session.provider)
    setAuthStatus('authenticated')
    setAuthError(null)
  }, [serverUrl])

  const authenticate = useCallback(async (
    provider: string,
    code: string,
    options?: { codeVerifier?: string; nonce?: string },
  ) => {
    if (!serverUrl.trim()) {
      setAuthError('Server URL is required before signing in.')
      appendEventLog('Server URL is required before signing in.')
      return
    }

    if (!code.trim() || !options?.codeVerifier || !options?.nonce) {
      setAuthError('A full OIDC redirect is required before exchanging the code.')
      appendEventLog('OIDC code exchange requires code verifier and nonce.')
      return
    }

    try {
      setAuthStatus('authenticating')
      setAuthError(null)
      savePendingAuthProvider(provider)
      appendEventLog(`Authenticating with ${provider}.`)

      const payload = await loginWithProvider(serverUrl, provider, {
        code: code.trim(),
        redirectUri: getAuthCallbackRedirectUri(provider),
        codeVerifier: options.codeVerifier,
        nonce: options.nonce,
      })
      const session = createSessionFromLogin(payload, provider)

      applyAuthenticatedSession(session, payload.user)
      connectAuthenticatedSocketRef.current(session.accessToken, payload.user.username)
      replaceBrowserRoute(HOME_ROUTE_PATH)
    } catch (error) {
      clearPendingAuthRedirect()
      clearPendingAuthProvider()
      setAuthStatus('unauthenticated')
      const message = error instanceof Error ? error.message : 'Authentication failed.'
      setAuthError(message)
      appendEventLog(`Authentication failed: ${message}`)
    }
  }, [appendEventLog, applyAuthenticatedSession, connectAuthenticatedSocketRef, serverUrl])

  const handleStartProviderLogin = useCallback(async () => {
    if (!serverUrl.trim()) {
      setAuthError('Server URL is required before signing in.')
      appendEventLog('Server URL is required before signing in.')
      return
    }

    try {
      const { codeChallenge, codeVerifier } = await createPkcePair()
      const state = createOAuthState()
      const nonce = createOidcNonce()
      const redirectUri = getAuthCallbackRedirectUri(selectedProvider)
      const authorizationUrl = buildProviderAuthorizationUrl(selectedProvider, {
        codeChallenge,
        nonce,
        redirectUri,
        state,
      })

      if (!authorizationUrl) {
        setAuthError(
          'Could not start provider redirect. Configure the provider authorization settings for this environment and try again.',
        )
        return
      }

      savePendingAuthProvider(selectedProvider)
      savePendingAuthRedirect({
        codeVerifier,
        createdAt: Date.now(),
        nonce,
        provider: selectedProvider,
        state,
      })
      setAuthError(null)
      window.location.assign(authorizationUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start provider login.'
      setAuthError(message)
      appendEventLog(`Could not start provider login: ${message}`)
    }
  }, [appendEventLog, selectedProvider, serverUrl])

  useEffect(() => {
    applyAuthenticatedSessionRef.current = applyAuthenticatedSession
  }, [applyAuthenticatedSession])

  useEffect(() => {
    authenticateRef.current = authenticate
  }, [authenticate])

  useEffect(() => {
    let isCancelled = false
    const callbackCode = getAuthCallbackCode()
    const callbackState = getAuthCallbackState()

    async function restoreOrRefreshSession() {
      const storedSession = loadStoredAuthSession(serverUrl)

      if (storedSession && storedSession.expiresAt > Date.now()) {
        setAuthStatus('checking')
        setAuthError(null)

        try {
          const user = await fetchCurrentUser(serverUrl, storedSession.accessToken)

          if (isCancelled) {
            return
          }

          applyAuthenticatedSessionRef.current(storedSession, user)
          connectAuthenticatedSocketRef.current(storedSession.accessToken, user.username)
          return
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 401) {
            const message = error instanceof Error ? error.message : 'Cannot restore session.'
            setAuthStatus('unauthenticated')
            setAuthError(message)
            return
          }
        }
      }

      try {
        setAuthStatus('checking')
        setAuthError(null)
        const payload = await refreshSession(serverUrl)

        if (isCancelled) {
          return
        }

        const provider = payload.user.provider ?? loadPendingAuthProvider() ?? DEFAULT_AUTH_PROVIDER
        const session = createSessionFromLogin(payload, provider)

        applyAuthenticatedSessionRef.current(session, payload.user)
        connectAuthenticatedSocketRef.current(session.accessToken, payload.user.username)
      } catch {
        if (isCancelled) {
          return
        }

        clearAuthState()
      }
    }

    if (callbackCode) {
      const pendingRedirect = loadPendingAuthRedirect()
      const provider = pendingRedirect?.provider ?? getAuthCallbackProvider(DEFAULT_AUTH_PROVIDER)

      if (!pendingRedirect || pendingRedirect.state !== callbackState) {
        clearPendingAuthRedirect()
        clearPendingAuthProvider()
        queueMicrotask(() => {
          if (!isCancelled) {
            clearAuthState('Authentication state check failed. Start sign-in again.')
          }
        })

        return () => {
          isCancelled = true
        }
      }

      queueMicrotask(() => {
        if (!isCancelled) {
          setSelectedProvider(provider)
        }
      })

      void authenticateRef.current(provider, callbackCode, {
        codeVerifier: pendingRedirect.codeVerifier,
        nonce: pendingRedirect.nonce,
      })
    } else {
      void restoreOrRefreshSession()
    }

    return () => {
      isCancelled = true
    }
  }, [clearAuthState, connectAuthenticatedSocketRef, serverUrl])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const isCallbackRoute = window.location.pathname.startsWith(`${AUTH_CALLBACK_ROUTE_PREFIX}/`)

    if (authStatus === 'authenticated') {
      if (window.location.pathname !== HOME_ROUTE_PATH && !isCallbackRoute) {
        replaceBrowserRoute(HOME_ROUTE_PATH)
      }

      return
    }

    if (getAuthCallbackCode()) {
      return
    }

    if (window.location.pathname !== LOGIN_ROUTE_PATH) {
      replaceBrowserRoute(LOGIN_ROUTE_PATH)
    }
  }, [authStatus])

  return {
    authError,
    authSession,
    authStatus,
    authUser,
    clearAuthState,
    currentUserLabel: getCurrentUserLabel(authUser),
    handleStartProviderLogin,
    providerRedirectEnabled: isProviderRedirectConfigured(selectedProvider),
    selectedProviderLabel: getProviderLabel(selectedProvider),
    setAuthError,
  }
}
