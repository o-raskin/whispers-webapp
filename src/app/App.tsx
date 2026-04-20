import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { WelcomeExperience } from '../features/welcome/components/WelcomeExperience'
import { toChatMessage, toMessageId } from '../shared/adapters/chatAdapters'
import {
  fetchCurrentUser,
  loginWithProvider,
  logoutCurrentSession,
  refreshSession,
} from '../shared/api/authApi'
import { ApiError } from '../shared/api/apiClient'
import {
  buildWebSocketProtocols,
  buildWebSocketUrl,
  createChat,
  fetchChats,
  fetchMessages,
  fetchUserProfile,
  fetchUsers,
  sendWebSocketCommand,
} from '../shared/api/chatApi'
import {
  clearPendingAuthRedirect,
  clearPendingAuthProvider,
  clearStoredAuthSession,
  loadPendingAuthRedirect,
  loadPendingAuthProvider,
  loadStoredAuthSession,
  saveAuthSession,
  savePendingAuthRedirect,
  savePendingAuthProvider,
} from '../shared/auth/authStorage'
import { createOAuthState, createOidcNonce, createPkcePair } from '../shared/auth/oauthRedirect'
import {
  AUTH_CALLBACK_PARAM,
  AUTH_CALLBACK_ROUTE_PREFIX,
  AUTH_PROVIDERS,
  AUTH_STATE_PARAM,
  buildProviderAuthorizationUrl,
  DEFAULT_AUTH_PROVIDER,
  getAuthCallbackRedirectUri,
  HOME_ROUTE_PATH,
  isProviderRedirectConfigured,
  LOGIN_ROUTE_PATH,
} from '../shared/config/auth'
import { DEFAULT_WS_URL, PRESENCE_PING_INTERVAL_MS } from '../shared/config/backend'
import { shellStagger } from '../shared/motion/presets'
import type {
  AuthSession,
  AuthUserProfile,
  LoginResponse,
} from '../shared/types/auth'
import type {
  ChatMessage,
  ChatSummary,
  ChatThread,
  ConnectionStatus,
  MessageRecord,
  PingCommand,
  TypingCommand,
  UserPresence,
  WebSocketIncomingEvent,
} from '../shared/types/chat'
import { isCallSignalText, parseCallSignalText } from '../shared/utils/callSignals'
import { AppWorkspace } from './components/AppWorkspace'
import { useCallSession } from './hooks/useCallSession'
import { useResponsiveAppShell } from './hooks/useResponsiveAppShell'
import { appendLog } from './utils/eventLog'
import {
  applyIncomingMessageToChats,
  clearChatUnreadCount,
  createSystemMessage,
  filterVisibleMessages,
  hydrateFetchedChats,
  mergeFetchedChats,
  setChatPreview,
  setChatTimestamp,
  upsertThread,
} from './utils/chatRuntime'
import { countUnreadMessages, loadReadMarkers, saveReadMarkers } from './utils/readMarkers'
import {
  hasTypedEventShape,
  isMessageRecord,
  isPresenceEvent,
  isTypingEvent,
  type WebSocketMessageRecordPayload,
} from './utils/websocketPayloadGuards'

const TYPING_REFRESH_INTERVAL_MS = 4000
type AuthStatus = 'authenticated' | 'authenticating' | 'checking' | 'unauthenticated'

function createSessionFromLogin(payload: LoginResponse, provider: string): AuthSession {
  return {
    accessToken: payload.accessToken,
    tokenType: payload.tokenType,
    expiresAt: Date.now() + payload.expiresInSeconds * 1000,
    provider,
  }
}

function normalizeSocketMessage(payload: WebSocketMessageRecordPayload): MessageRecord {
  return {
    ...payload,
    chatId: String(payload.chatId),
  }
}

function replaceBrowserRoute(pathname: string) {
  if (typeof window === 'undefined') {
    return
  }

  const nextUrl = new URL(window.location.href)
  nextUrl.pathname = pathname
  nextUrl.search = ''
  nextUrl.hash = ''
  window.history.replaceState({}, '', nextUrl)
}

function getAuthCallbackCode() {
  if (typeof window === 'undefined') {
    return ''
  }

  return new URLSearchParams(window.location.search).get(AUTH_CALLBACK_PARAM)?.trim() ?? ''
}

function getAuthCallbackState() {
  if (typeof window === 'undefined') {
    return ''
  }

  return new URLSearchParams(window.location.search).get(AUTH_STATE_PARAM)?.trim() ?? ''
}

function getAuthCallbackProvider(selectedProvider: string) {
  if (typeof window === 'undefined') {
    return selectedProvider
  }

  const callbackPath = window.location.pathname

  if (callbackPath.startsWith(`${AUTH_CALLBACK_ROUTE_PREFIX}/`)) {
    const provider = callbackPath.slice(`${AUTH_CALLBACK_ROUTE_PREFIX}/`.length).split('/')[0]

    if (provider) {
      return provider
    }
  }

  return (
    loadPendingAuthProvider() ??
    (AUTH_PROVIDERS.length === 1 ? AUTH_PROVIDERS[0].id : selectedProvider)
  )
}

function getCurrentUserLabel(user: AuthUserProfile | null) {
  if (!user) {
    return ''
  }

  return user.displayName?.trim() || user.email || user.username
}

export function App() {
  const socketRef = useRef<WebSocket | null>(null)
  const pingTimerRef = useRef<number | null>(null)
  const typingTimerRef = useRef<number | null>(null)
  const activeTypingChatIdRef = useRef<string | null>(null)
  const userIdRef = useRef('')
  const chatsRef = useRef<ChatSummary[]>([])
  const connectAuthenticatedSocketRef = useRef<(accessToken: string, username: string) => void>(
    () => {},
  )
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
  const selectedChatIdRef = useRef<string | null>(null)
  const threadsRef = useRef<Record<string, ChatThread>>({})
  const readMarkersRef = useRef<Record<string, string>>({})

  const [serverUrl, setServerUrl] = useState(DEFAULT_WS_URL)
  const [selectedProvider, setSelectedProvider] = useState(DEFAULT_AUTH_PROVIDER)
  const [, setAuthCode] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authSession, setAuthSession] = useState<AuthSession | null>(null)
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking')
  const [authUser, setAuthUser] = useState<AuthUserProfile | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [users, setUsers] = useState<Record<string, UserPresence>>({})
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [threads, setThreads] = useState<Record<string, ChatThread>>({})
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [newChatUserId, setNewChatUserId] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [remoteTypingByChatId, setRemoteTypingByChatId] = useState<Record<string, string>>({})
  const [readMarkers, setReadMarkers] = useState<Record<string, string>>({})
  const [eventLog, setEventLog] = useState<string[]>([
    '[09:00:12] Client initialized from swagger contract.',
  ])

  const { handleShellPointerLeave, handleShellPointerMove, isMobileLayout } =
    useResponsiveAppShell()

  const currentUserId = authUser?.username.trim() ?? ''
  const currentUserLabel = getCurrentUserLabel(authUser)
  const selectedThread = selectedChatId ? threads[selectedChatId] ?? null : null
  const selectedChatSummary = selectedChatId
    ? chats.find((chat) => chat.chatId === selectedChatId) ?? null
    : null
  const selectedUser = selectedThread ? users[selectedThread.participant] ?? null : null
  const remoteTypingLabel = selectedChatId ? remoteTypingByChatId[selectedChatId] ?? null : null
  const showWelcome = authStatus !== 'authenticated'
  const isDrafting = Boolean(messageDraft.trim())
  const isMobileChatOpen = isMobileLayout && Boolean(selectedChatId)
  const isCallbackRoute =
    typeof window !== 'undefined' &&
    window.location.pathname.startsWith(`${AUTH_CALLBACK_ROUTE_PREFIX}/`)
  const providerRedirectEnabled = isProviderRedirectConfigured(selectedProvider)

  userIdRef.current = currentUserId
  chatsRef.current = chats
  selectedChatIdRef.current = selectedChatId
  threadsRef.current = threads
  readMarkersRef.current = readMarkers

  const appendEventLog = useCallback((message: string) => {
    setEventLog((current) => appendLog(current, message))
  }, [])

  const clearTypingRefreshTimer = useCallback(() => {
    if (typingTimerRef.current !== null) {
      window.clearInterval(typingTimerRef.current)
      typingTimerRef.current = null
    }
  }, [])

  const appendSystemMessage = useCallback((chatId: string | null, text: string) => {
    if (!chatId) {
      return
    }

    setThreads((current) => {
      const existingThread = current[chatId]

      if (!existingThread) {
        return current
      }

      return {
        ...current,
        [chatId]: {
          ...existingThread,
          messages: [...existingThread.messages, createSystemMessage(chatId, text)],
        },
      }
    })
  }, [])

  const clearRemoteTyping = useCallback((chatId: string) => {
    setRemoteTypingByChatId((current) => {
      if (!current[chatId]) {
        return current
      }

      const next = { ...current }
      delete next[chatId]
      return next
    })
  }, [])

  const upsertMessages = useCallback((
    chatId: string,
    participant: string,
    incomingMessages: ChatMessage[],
  ) => {
    setThreads((current) => upsertThread(current, chatId, participant, incomingMessages))
  }, [])

  const syncChatPreview = useCallback((chatId: string, preview: string) => {
    setChats((current) => setChatPreview(current, chatId, preview))
  }, [])

  const syncChatTimestamp = useCallback((chatId: string, lastMessageTimestamp: string) => {
    setChats((current) => setChatTimestamp(current, chatId, lastMessageTimestamp))
  }, [])

  const markChatAsRead = useCallback((chatId: string, timestamp: string | null | undefined) => {
    if (!timestamp) {
      return
    }

    setReadMarkers((current) => {
      const existingMarker = current[chatId]

      if (existingMarker && existingMarker.localeCompare(timestamp) >= 0) {
        return current
      }

      return {
        ...current,
        [chatId]: timestamp,
      }
    })

    setChats((current) => clearChatUnreadCount(current, chatId))
  }, [])

  const resetRealtimeState = useCallback((cleanupReason: string) => {
    setStatus('disconnected')
    setIsBootstrapping(false)
    setIsHistoryLoading(false)
    setChats([])
    setRemoteTypingByChatId({})
    setUsers({})
    setThreads({})
    setSelectedChatId(null)
    setReadMarkers({})
    setMessageDraft('')
    clearTypingRefreshTimer()
    activeTypingChatIdRef.current = null
    appendEventLog(`Realtime state reset: ${cleanupReason}`)
  }, [appendEventLog, clearTypingRefreshTimer])

  const handleUnauthorizedAccess = useCallback((message: string) => {
    socketRef.current?.close()
    socketRef.current = null
    clearStoredAuthSession(serverUrl)
    clearPendingAuthRedirect()
    clearPendingAuthProvider()
    setAuthSession(null)
    setAuthUser(null)
    setAuthStatus('unauthenticated')
    setAuthCode('')
    setAuthError(message)
    resetRealtimeState('unauthorized')
  }, [resetRealtimeState, serverUrl])

  const handleProtectedRequestError = useCallback((error: unknown, fallbackMessage: string) => {
    if (error instanceof ApiError && error.status === 401) {
      handleUnauthorizedAccess(error.message)
      throw error
    }

    const message = error instanceof Error ? error.message : fallbackMessage
    throw new Error(message)
  }, [handleUnauthorizedAccess])

  const hydrateChatSummaries = useCallback(async (
    accessToken: string,
    nextUserId: string,
    chatSummaries: ChatSummary[],
  ) => {
    if (chatSummaries.length === 0) {
      return
    }

    const historyResults = await Promise.allSettled(
      chatSummaries.map(async (chat) => {
        const messages = filterVisibleMessages(
          await fetchMessages(serverUrl, accessToken, chat.chatId),
        )
        const latestMessage = messages.at(-1)
        const readMarker = readMarkersRef.current[chat.chatId]

        return {
          chatId: chat.chatId,
          preview: latestMessage?.text ?? '',
          lastMessageTimestamp: latestMessage?.timestamp,
          unreadCount: countUnreadMessages(messages, nextUserId, readMarker),
        }
      }),
    )

    const failedChats = historyResults.filter((result) => result.status === 'rejected')

    if (failedChats.length > 0) {
      appendEventLog(
        `Could not hydrate ${failedChats.length} chat preview${failedChats.length === 1 ? '' : 's'} during login.`,
      )
    }

    const hydratedByChatId = new Map<
      string,
      { lastMessageTimestamp?: string; preview: string; unreadCount: number }
    >()

    for (const result of historyResults) {
      if (result.status === 'fulfilled') {
        hydratedByChatId.set(result.value.chatId, {
          lastMessageTimestamp: result.value.lastMessageTimestamp,
          preview: result.value.preview,
          unreadCount: result.value.unreadCount,
        })
      }
    }

    setChats((current) =>
      hydrateFetchedChats(current, hydratedByChatId, selectedChatIdRef.current),
    )
  }, [appendEventLog, serverUrl])

  const refreshUsers = useCallback(async (accessToken: string) => {
    const payload = await fetchUsers(serverUrl, accessToken)

    setUsers((current) => {
      const nextUsers: Record<string, UserPresence> = {}

      for (const user of payload) {
        nextUsers[user.username] = {
          ...user,
          lastPingReceivedAt: current[user.username]?.lastPingReceivedAt ?? null,
        }
      }

      return nextUsers
    })
  }, [serverUrl])

  const enrichDirectChats = useCallback(async (
    accessToken: string,
    chatSummaries: ChatSummary[],
  ) => {
    const directChats = chatSummaries.filter((chat) => (chat.type ?? 'DIRECT') === 'DIRECT')

    if (directChats.length === 0) {
      return chatSummaries
    }

    const profileResults = await Promise.allSettled(
      directChats.map(async (chat) => ({
        username: chat.username,
        profile: await fetchUserProfile(serverUrl, accessToken, chat.username),
      })),
    )

    const failedProfiles = profileResults.filter((result) => result.status === 'rejected')
    const profileByUsername = new Map<
      string,
      { firstName?: string | null; lastName?: string | null; profileUrl?: string | null }
    >()

    for (const result of profileResults) {
      if (result.status === 'fulfilled') {
        profileByUsername.set(result.value.username, result.value.profile)
      }
    }

    if (failedProfiles.length > 0) {
      appendEventLog(
        `Could not enrich ${failedProfiles.length} direct chat profile${failedProfiles.length === 1 ? '' : 's'}.`,
      )
    }

    return chatSummaries.map((chat) => {
      if ((chat.type ?? 'DIRECT') !== 'DIRECT') {
        return chat
      }

      const profile = profileByUsername.get(chat.username)

      if (!profile) {
        return chat
      }

      return {
        ...chat,
        firstName: profile.firstName ?? chat.firstName ?? null,
        lastName: profile.lastName ?? chat.lastName ?? null,
        profileUrl: profile.profileUrl ?? chat.profileUrl ?? null,
      }
    })
  }, [appendEventLog, serverUrl])

  const refreshChats = useCallback(async (accessToken: string, nextUserId: string) => {
    const payload = await fetchChats(serverUrl, accessToken)
    const enrichedPayload = await enrichDirectChats(accessToken, payload)

    setChats((current) => mergeFetchedChats(current, enrichedPayload))

    setSelectedChatId((current) => {
      if (current && enrichedPayload.some((chat) => chat.chatId === current)) {
        return current
      }

      return null
    })

    await hydrateChatSummaries(accessToken, nextUserId, enrichedPayload)
  }, [enrichDirectChats, hydrateChatSummaries, serverUrl])

  const loadHistory = useCallback(async (chatId: string, nextUserId: string) => {
    if (!authSession) {
      return
    }

    const chat = chatsRef.current.find((entry) => entry.chatId === chatId)

    if (!chat) {
      return
    }

    const payload = filterVisibleMessages(
      await fetchMessages(serverUrl, authSession.accessToken, chatId),
    )
    const normalizedMessages = payload.map((message) => toChatMessage(message, nextUserId))
    const latestMessage = normalizedMessages.at(-1)

    upsertMessages(chatId, chat.username, normalizedMessages)
    syncChatPreview(chatId, latestMessage?.text ?? '')

    if (latestMessage) {
      syncChatTimestamp(chatId, latestMessage.timestamp)
      markChatAsRead(chatId, latestMessage.timestamp)
    }
  }, [authSession, markChatAsRead, serverUrl, syncChatPreview, syncChatTimestamp, upsertMessages])

  const {
    acceptCall,
    activeCallState,
    cleanupCallSession,
    endActiveCall,
    handleCallSignalMessage,
    localCallStream,
    rejectIncomingCall,
    remoteCallStream,
    startCall,
  } = useCallSession({
    appendEventLog,
    chatsRef,
    loadHistory,
    selectedChatIdRef,
    setIsHistoryLoading,
    setSelectedChatId,
    socketRef,
    threadsRef,
    userIdRef,
  })

  const sendTypingCommand = useCallback((
    payload: TypingCommand,
    options?: { log?: boolean },
  ) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      return false
    }

    sendWebSocketCommand(socketRef.current, payload)

    if (options?.log ?? true) {
      appendEventLog(`Sent: ${JSON.stringify(payload)}`)
    }

    return true
  }, [appendEventLog])

  const startLocalTyping = useCallback((chatId: string, options?: { log?: boolean }) => {
    const didSend = sendTypingCommand({ type: 'TYPING_START', chatId }, options)
    activeTypingChatIdRef.current = didSend ? chatId : null
    return didSend
  }, [sendTypingCommand])

  const stopLocalTyping = useCallback((chatId = activeTypingChatIdRef.current, options?: { log?: boolean }) => {
    clearTypingRefreshTimer()
    activeTypingChatIdRef.current = null

    if (!chatId) {
      return
    }

    void sendTypingCommand({ type: 'TYPING_END', chatId }, options)
  }, [clearTypingRefreshTimer, sendTypingCommand])

  const connectAuthenticatedSocket = useCallback((accessToken: string, username: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      appendEventLog('Already connected.')
      return
    }

    if (socketRef.current?.readyState === WebSocket.CONNECTING) {
      appendEventLog('Connection already in progress.')
      return
    }

    const url = buildWebSocketUrl(serverUrl)
    const socket = new WebSocket(url, buildWebSocketProtocols(accessToken))
    socketRef.current = socket

    setStatus('connecting')
    appendEventLog(`Connecting to ${url}`)

    socket.onopen = () => {
      setStatus('connected')
      setIsBootstrapping(true)
      setReadMarkers(loadReadMarkers(username))
      appendEventLog(`WebSocket connected as ${username}.`)

      Promise.all([
        refreshChats(accessToken, username).catch((error) =>
          handleProtectedRequestError(error, 'Cannot load chats.'),
        ),
        refreshUsers(accessToken).catch((error) =>
          handleProtectedRequestError(error, 'Cannot load users.'),
        ),
      ])
        .catch((error: Error) => {
          appendEventLog(`Cannot load initial data: ${error.message}`)
        })
        .finally(() => {
          setIsBootstrapping(false)
        })
    }

    socket.onmessage = (event) => {
      const raw = String(event.data)
      appendEventLog(`Received: ${raw}`)

      if (raw.startsWith('CONNECTED:')) {
        return
      }

      if (raw.startsWith('ERROR:')) {
        appendSystemMessage(selectedChatIdRef.current, raw)
        return
      }

      let payload: unknown

      try {
        payload = JSON.parse(raw) as WebSocketIncomingEvent
      } catch {
        appendEventLog(`Ignored non-JSON message: ${raw}`)
        return
      }

      if (isMessageRecord(payload)) {
        const normalizedPayload = normalizeSocketMessage(payload)

        if (isCallSignalText(normalizedPayload.text)) {
          const signal = parseCallSignalText(normalizedPayload.text)

          if (!signal) {
            appendEventLog('Ignored malformed hidden call signal message.')
            return
          }

          void handleCallSignalMessage(normalizedPayload, signal)
          return
        }

        const message: ChatMessage = {
          ...toChatMessage(normalizedPayload, userIdRef.current),
          id: toMessageId(normalizedPayload),
        }

        if (message.senderUserId !== userIdRef.current) {
          clearRemoteTyping(message.chatId)
        }

        const chat = chatsRef.current.find((entry) => entry.chatId === message.chatId)
        upsertMessages(message.chatId, chat?.username ?? message.senderUserId, [message])

        setChats((current) => {
          if (!current.some((entry) => entry.chatId === message.chatId)) {
            void refreshChats(accessToken, userIdRef.current).catch((error) => {
              const messageText =
                error instanceof Error ? error.message : 'Cannot refresh chats.'
              appendEventLog(`Cannot refresh chats: ${messageText}`)
            })
            return current
          }

          if (selectedChatIdRef.current === message.chatId) {
            markChatAsRead(message.chatId, message.timestamp)
          }

          return (
            applyIncomingMessageToChats(
              current,
              message,
              selectedChatIdRef.current,
              userIdRef.current,
            ) ?? current
          )
        })

        return
      }

      if (isPresenceEvent(payload)) {
        setUsers((current) => ({
          ...current,
          [payload.username]: {
            username: payload.username,
            lastPingReceivedAt: Date.now(),
            lastPingTime: payload.lastPingTime,
          },
        }))
        return
      }

      if (isTypingEvent(payload)) {
        const chatId = String(payload.chatId)

        if (payload.username && payload.username === userIdRef.current) {
          return
        }

        if (payload.type === 'typing:stop' || payload.type === 'TYPING_END') {
          clearRemoteTyping(chatId)
          return
        }

        const chat = chatsRef.current.find((entry) => entry.chatId === chatId)
        const typingUser =
          payload.username && payload.username !== userIdRef.current
            ? payload.username
            : chat?.username ?? 'Someone'

        setRemoteTypingByChatId((current) => ({
          ...current,
          [chatId]: typingUser,
        }))
        return
      }

      if (hasTypedEventShape(payload)) {
        appendEventLog(`Ignored unsupported websocket event type: ${String(payload.type)}`)
        return
      }

      appendEventLog('Ignored websocket payload with unsupported structure.')
    }

    socket.onerror = () => {
      appendEventLog('WebSocket error.')
      appendSystemMessage(selectedChatIdRef.current, 'WebSocket error.')
    }

    socket.onclose = () => {
      appendEventLog('WebSocket closed.')
      setStatus('disconnected')
      setIsBootstrapping(false)
      setIsHistoryLoading(false)
      setChats([])
      setRemoteTypingByChatId({})
      setUsers({})
      setThreads({})
      setSelectedChatId(null)
      setReadMarkers({})
      cleanupCallSession('socket-closed')
      clearTypingRefreshTimer()
      activeTypingChatIdRef.current = null
      socketRef.current = null
    }
  }, [
    appendEventLog,
    appendSystemMessage,
    cleanupCallSession,
    clearRemoteTyping,
    clearTypingRefreshTimer,
    handleCallSignalMessage,
    handleProtectedRequestError,
    markChatAsRead,
    refreshChats,
    refreshUsers,
    serverUrl,
    upsertMessages,
  ])

  useEffect(() => {
    connectAuthenticatedSocketRef.current = connectAuthenticatedSocket
  }, [connectAuthenticatedSocket])

  const applyAuthenticatedSession = useCallback((session: AuthSession, user: AuthUserProfile) => {
    saveAuthSession(serverUrl, session)
    clearPendingAuthRedirect()
    clearPendingAuthProvider()
    setAuthSession(session)
    setAuthUser(user)
    setSelectedProvider(session.provider)
    setAuthStatus('authenticated')
    setAuthError(null)
    setAuthCode('')
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
      connectAuthenticatedSocket(session.accessToken, payload.user.username)
      replaceBrowserRoute(HOME_ROUTE_PATH)
    } catch (error) {
      clearPendingAuthRedirect()
      clearPendingAuthProvider()
      setAuthStatus('unauthenticated')
      const message = error instanceof Error ? error.message : 'Authentication failed.'
      setAuthError(message)
      appendEventLog(`Authentication failed: ${message}`)
    }
  }, [appendEventLog, applyAuthenticatedSession, connectAuthenticatedSocket, serverUrl])

  useEffect(() => {
    applyAuthenticatedSessionRef.current = applyAuthenticatedSession
  }, [applyAuthenticatedSession])

  useEffect(() => {
    authenticateRef.current = authenticate
  }, [authenticate])

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

        clearStoredAuthSession(serverUrl)
        clearPendingAuthRedirect()
        clearPendingAuthProvider()
        setAuthSession(null)
        setAuthUser(null)
        setAuthStatus('unauthenticated')
      }
    }

    if (callbackCode) {
      const pendingRedirect = loadPendingAuthRedirect()
      const provider = pendingRedirect?.provider ?? getAuthCallbackProvider(DEFAULT_AUTH_PROVIDER)

      if (!pendingRedirect || pendingRedirect.state !== callbackState) {
        clearPendingAuthRedirect()
        clearPendingAuthProvider()
        setAuthStatus('unauthenticated')
        setAuthError('Authentication state check failed. Start sign-in again.')
        return () => {
          isCancelled = true
        }
      }

      setSelectedProvider(provider)
      setAuthCode(callbackCode)
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
  }, [serverUrl])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

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
  }, [authStatus, isCallbackRoute])

  const handleSelectChat = useCallback((chatId: string) => {
    if (activeCallState && activeCallState.chatId !== chatId) {
      endActiveCall({ notifyRemote: true })
    }

    setSelectedChatId(chatId)
    setIsHistoryLoading(true)
  }, [activeCallState, endActiveCall])

  useEffect(() => {
    if (!currentUserId) {
      return
    }

    saveReadMarkers(currentUserId, readMarkers)
  }, [currentUserId, readMarkers])

  useEffect(() => {
    if (!selectedChatId || !currentUserId) {
      return
    }

    setIsHistoryLoading(true)
    loadHistory(selectedChatId, currentUserId)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          handleUnauthorizedAccess(error.message)
          return
        }

        const message = error instanceof Error ? error.message : 'Cannot load history.'
        appendEventLog(`Cannot load history: ${message}`)
        appendSystemMessage(selectedChatId, `Cannot load history: ${message}`)
      })
      .finally(() => {
        setIsHistoryLoading(false)
      })
  }, [
    appendEventLog,
    appendSystemMessage,
    currentUserId,
    handleUnauthorizedAccess,
    loadHistory,
    selectedChatId,
  ])

  useEffect(() => {
    if (status !== 'connected' || !currentUserId) {
      if (pingTimerRef.current !== null) {
        window.clearInterval(pingTimerRef.current)
        pingTimerRef.current = null
      }

      return
    }

    const runPing = () => {
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        return
      }

      const pingPayload: PingCommand = { type: 'PRESENCE' }
      sendWebSocketCommand(socketRef.current, pingPayload)
      appendEventLog(`Sent: ${JSON.stringify(pingPayload)}`)
    }

    runPing()
    pingTimerRef.current = window.setInterval(runPing, PRESENCE_PING_INTERVAL_MS)

    return () => {
      if (pingTimerRef.current !== null) {
        window.clearInterval(pingTimerRef.current)
        pingTimerRef.current = null
      }
    }
  }, [appendEventLog, currentUserId, status])

  useEffect(() => {
    const trimmedDraft = messageDraft.trim()

    if (status !== 'connected' || !selectedChatId || !trimmedDraft) {
      if (activeTypingChatIdRef.current) {
        stopLocalTyping(activeTypingChatIdRef.current)
      } else {
        clearTypingRefreshTimer()
      }

      return
    }

    if (activeTypingChatIdRef.current && activeTypingChatIdRef.current !== selectedChatId) {
      stopLocalTyping(activeTypingChatIdRef.current)
    }

    if (activeTypingChatIdRef.current !== selectedChatId) {
      const didStart = startLocalTyping(selectedChatId)

      if (!didStart) {
        return
      }
    }

    clearTypingRefreshTimer()
    typingTimerRef.current = window.setInterval(() => {
      const chatId = activeTypingChatIdRef.current

      if (!chatId) {
        return
      }

      void sendTypingCommand({ type: 'TYPING_START', chatId }, { log: false })
    }, TYPING_REFRESH_INTERVAL_MS)

    return () => {
      clearTypingRefreshTimer()
    }
  }, [
    clearTypingRefreshTimer,
    messageDraft,
    selectedChatId,
    sendTypingCommand,
    startLocalTyping,
    status,
    stopLocalTyping,
  ])

  useEffect(() => {
    appendEventLog('WebRTC component cleanup effect mounted')

    return () => {
      if (pingTimerRef.current !== null) {
        window.clearInterval(pingTimerRef.current)
      }

      clearTypingRefreshTimer()
      cleanupCallSession('component-unmount')
      socketRef.current?.close()
    }
  }, [appendEventLog, cleanupCallSession, clearTypingRefreshTimer])

  const handleConnect = useCallback(() => {
    if (!authSession || !currentUserId) {
      setAuthError('Sign in first to connect the realtime workspace.')
      return
    }

    connectAuthenticatedSocket(authSession.accessToken, currentUserId)
  }, [authSession, connectAuthenticatedSocket, currentUserId])

  const handleLogout = useCallback(async () => {
    const session = authSession

    if (session) {
      try {
        await logoutCurrentSession(serverUrl, session.accessToken)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Logout failed.'
        appendEventLog(`Logout request failed: ${message}`)
      }
    }

    endActiveCall({ notifyRemote: true })
    stopLocalTyping(activeTypingChatIdRef.current)
    socketRef.current?.close()
    socketRef.current = null
    clearStoredAuthSession(serverUrl)
    clearPendingAuthRedirect()
    clearPendingAuthProvider()
    setAuthSession(null)
    setAuthUser(null)
    setAuthStatus('unauthenticated')
    setAuthCode('')
    setAuthError(null)
    resetRealtimeState('logout')
  }, [
    appendEventLog,
    authSession,
    endActiveCall,
    resetRealtimeState,
    serverUrl,
    stopLocalTyping,
  ])

  const handleCreateChat = useCallback(async () => {
    if (socketRef.current?.readyState !== WebSocket.OPEN || !authSession) {
      appendEventLog('Connect first.')
      return
    }

    const username = newChatUserId.trim().toLowerCase()

    if (!username) {
      appendEventLog('Cannot create chat without a username.')
      return
    }

    try {
      const chat = await createChat(serverUrl, authSession.accessToken, username)
      setNewChatUserId('')
      appendEventLog(`Chat created: ${chat.chatId}`)
      await Promise.all([
        refreshChats(authSession.accessToken, currentUserId),
        refreshUsers(authSession.accessToken),
      ])
      setSelectedChatId(chat.chatId)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorizedAccess(error.message)
        return
      }

      const message = error instanceof Error ? error.message : 'Create chat failed.'
      appendEventLog(`Create chat failed: ${message}`)
      appendSystemMessage(selectedChatIdRef.current, `Create chat failed: ${message}`)
    }
  }, [
    appendEventLog,
    appendSystemMessage,
    authSession,
    currentUserId,
    handleUnauthorizedAccess,
    newChatUserId,
    refreshChats,
    refreshUsers,
    serverUrl,
  ])

  const handleSendMessage = useCallback(() => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      appendEventLog('Connect first.')
      return
    }

    if (!selectedThread || !messageDraft.trim()) {
      appendEventLog('Select a chat and enter a message.')
      return
    }

    const payload = {
      type: 'MESSAGE' as const,
      chatId: selectedThread.chatId,
      text: messageDraft.trim(),
    }

    sendWebSocketCommand(socketRef.current, payload)
    appendEventLog(`Sent: ${JSON.stringify(payload)}`)
    stopLocalTyping(selectedThread.chatId)
    setMessageDraft('')
  }, [appendEventLog, messageDraft, selectedThread, stopLocalTyping])

  const selectedCallState =
    activeCallState && activeCallState.chatId === selectedChatId ? activeCallState : null

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className="app-frame"
        variants={shellStagger}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          className="ambient ambient-one"
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 0.72, scale: 1 }}
          transition={{ duration: 1.2 }}
        />
        <motion.div
          className="ambient ambient-two"
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 0.62, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.08 }}
        />
        <motion.div
          className="ambient ambient-three"
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 0.56, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.16 }}
        />

        <motion.main
          className={`app-shell ${showWelcome ? 'is-welcome-active' : ''}`}
          onPointerMove={handleShellPointerMove}
          onPointerLeave={handleShellPointerLeave}
          variants={shellStagger}
        >
          <AnimatePresence>
            {showWelcome ? (
              <WelcomeExperience
                authError={authError}
                authStatus={authStatus}
                currentUser={authUser}
                providerRedirectEnabled={providerRedirectEnabled}
                providerLabel={
                  AUTH_PROVIDERS.find((provider) => provider.id === selectedProvider)?.label ??
                  selectedProvider
                }
                serverUrl={serverUrl}
                status={status}
                onConnect={handleConnect}
                onLogout={() => {
                  void handleLogout()
                }}
                onServerUrlChange={setServerUrl}
                onStartGoogleLogin={() => {
                  void handleStartProviderLogin()
                }}
              />
            ) : null}
          </AnimatePresence>

          <AppWorkspace
            isMobileLayout={isMobileLayout}
            isMobileChatOpen={isMobileChatOpen}
            selectedChatId={selectedChatId}
            eventLogLines={eventLog.slice(0, 18)}
            sidebarProps={{
              chats,
              currentUser: authUser,
              currentUserId: currentUserLabel || currentUserId,
              newChatUserId,
              onCreateChat: handleCreateChat,
              onDisconnect: () => {
                void handleLogout()
              },
              onNewChatUserIdChange: setNewChatUserId,
              onSelectChat: handleSelectChat,
              selectedChatId,
              status,
              users,
            }}
            conversationProps={{
              callPhase: selectedCallState?.phase ?? 'idle',
              connectionStatus: status,
              currentUserId,
              isDrafting,
              isHistoryLoading: isHistoryLoading || isBootstrapping,
              isMobileLayout,
              localCallStream,
              messageDraft,
              onAcceptCall: acceptCall,
              onBackToInbox: () => setSelectedChatId(null),
              onDeclineCall: rejectIncomingCall,
              onEndCall: () => endActiveCall({ notifyRemote: true }),
              onMessageDraftChange: setMessageDraft,
              onSendMessage: handleSendMessage,
              onStartCall: () => {
                void startCall(selectedThread)
              },
              pendingParticipantName:
                selectedThread?.participant ?? selectedChatSummary?.username ?? null,
              participantProfile: selectedChatSummary,
              remoteCallStream,
              remoteTypingLabel,
              thread: selectedThread,
              user: selectedUser,
            }}
          />
        </motion.main>
      </motion.div>
    </MotionConfig>
  )
}
