import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WelcomeExperience } from '../features/welcome/components/WelcomeExperience'
import { toChatMessage, toMessageId } from '../shared/adapters/chatAdapters'
import { logoutCurrentSession } from '../shared/api/authApi'
import { ApiError } from '../shared/api/apiClient'
import {
  createChat,
  deleteChat,
  deleteMessage,
  editMessage,
  fetchChats,
  fetchMessages,
  fetchUserProfile,
  fetchUsers,
  sendWebSocketCommand,
} from '../shared/api/chatApi'
import { fetchPrivateMessages } from '../shared/api/privateChatApi'
import { DEFAULT_WS_URL } from '../shared/config/backend'
import { shellStagger } from '../shared/motion/presets'
import { decryptPrivateMessage } from '../shared/private-chat/privateChatCrypto'
import {
  ensureRegisteredPrivateChatBrowserIdentity,
  isPrivateChatSupported,
  loadPrivateChatBrowserIdentity,
} from '../shared/private-chat/privateChatService'
import type {
  ChatMessage,
  ChatSummary,
  ChatThread,
  ConnectionStatus,
  MessageRecord,
  PrivateMessageRecord,
  UserPresence,
} from '../shared/types/chat'
import { AppWorkspace } from './components/AppWorkspace'
import { useAppAuth } from './hooks/useAppAuth'
import { useAppCallCoordinator } from './hooks/useAppCallCoordinator'
import { usePrivateChatManager } from './hooks/usePrivateChatManager'
import { useRealtimeConnection, type StopLocalTyping } from './hooks/useRealtimeConnection'
import { useResponsiveAppShell } from './hooks/useResponsiveAppShell'
import { deriveAppViewModel } from './utils/appViewModel'
import { appendLog } from './utils/eventLog'
import {
  applyIncomingMessageToChats,
  canDeleteChat,
  clearChatUnreadCount,
  createSystemMessage,
  editMessageInThread,
  filterVisibleMessages,
  hydrateFetchedChats,
  mergeFetchedChats,
  removeChatFromList,
  removeMessageFromThread,
  setChatPreview,
  setChatTimestamp,
  syncChatAfterMessageEdit,
  syncChatAfterMessageRemoval,
  upsertThread,
} from './utils/chatRuntime'
import {
  DEFAULT_PRIVATE_CHAT_SESSION_STATE,
  PRIVATE_CHAT_ERROR_NOTICE,
  toPrivateChatMessage,
  type PrivateChatSessionState,
} from './utils/privateChatRuntime'
import { countUnreadMessages, loadReadMarkers, saveReadMarkers } from './utils/readMarkers'

interface LoadHistoryOptions {
  allowPrivateKeySetup?: boolean
}

interface EditingMessageState {
  chatId: string
  messageId: string
  previousDraft: string
  text: string
}

export function App() {
  const socketRef = useRef<WebSocket | null>(null)
  const stopLocalTypingRef = useRef<StopLocalTyping>(() => {})
  const userIdRef = useRef('')
  const chatsRef = useRef<ChatSummary[]>([])
  const connectAuthenticatedSocketRef = useRef<(accessToken: string, username: string) => void>(
    () => {},
  )
  const selectedChatIdRef = useRef<string | null>(null)
  const threadsRef = useRef<Record<string, ChatThread>>({})
  const readMarkersRef = useRef<Record<string, string>>({})
  const privateChatOwnerIdRef = useRef('')
  const privateChatOwnerFallbackIdsRef = useRef<string[]>([])

  const [serverUrl, setServerUrl] = useState(DEFAULT_WS_URL)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [users, setUsers] = useState<Record<string, UserPresence>>({})
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [threads, setThreads] = useState<Record<string, ChatThread>>({})
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [newChatUserId, setNewChatUserId] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const [editingMessage, setEditingMessage] = useState<EditingMessageState | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [remoteTypingByChatId, setRemoteTypingByChatId] = useState<Record<string, string>>({})
  const [readMarkers, setReadMarkers] = useState<Record<string, string>>({})
  const [privateChatSessions, setPrivateChatSessions] = useState<
    Record<string, PrivateChatSessionState>
  >({})
  const [eventLog, setEventLog] = useState<string[]>([
    '[09:00:12] Client initialized from swagger contract.',
  ])

  const appendEventLog = useCallback((message: string) => {
    setEventLog((current) => appendLog(current, message))
  }, [])

  const { handleShellPointerLeave, handleShellPointerMove, isMobileLayout } =
    useResponsiveAppShell()
  const privateChatFeatureSupported = isPrivateChatSupported()
  const {
    authError,
    authSession,
    authStatus,
    authUser,
    clearAuthState,
    handleStartProviderLogin,
    providerRedirectEnabled,
    selectedProviderLabel,
    setAuthError,
  } = useAppAuth({
    appendEventLog,
    connectAuthenticatedSocketRef,
    serverUrl,
  })
  const {
    currentUserId,
    isDrafting,
    isMobileChatOpen,
    remoteTypingLabel,
    selectedChatSummary,
    selectedPrivateChatSession,
    selectedThread,
    selectedUser,
    showWelcome,
  } = deriveAppViewModel({
    authStatus,
    authUser,
    chats,
    isMobileLayout,
    messageDraft,
    privateChatSessions,
    remoteTypingByChatId,
    selectedChatId,
    threads,
    users,
  })
  const privateChatOwnerId = (
    authUser?.email.trim().toLowerCase() ||
    authUser?.userId.trim() ||
    currentUserId
  )
  const privateChatOwnerFallbackIds = useMemo(() =>
    Array.from(
      new Set(
        [
          authUser?.email.trim() ?? '',
          authUser?.email.trim().toLowerCase() ?? '',
          authUser?.userId.trim() ?? '',
          authUser?.username.trim() ?? '',
          authUser?.username.trim().toLowerCase() ?? '',
          currentUserId.trim(),
        ].filter((value) => Boolean(value) && value !== privateChatOwnerId),
      ),
    ),
  [authUser?.email, authUser?.userId, authUser?.username, currentUserId, privateChatOwnerId])

  userIdRef.current = currentUserId
  chatsRef.current = chats
  selectedChatIdRef.current = selectedChatId
  threadsRef.current = threads
  readMarkersRef.current = readMarkers
  privateChatOwnerIdRef.current = privateChatOwnerId
  privateChatOwnerFallbackIdsRef.current = privateChatOwnerFallbackIds

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

  const removeDeletedChat = useCallback((chatId: string) => {
    setChats((current) => removeChatFromList(current, chatId))
    setSelectedChatId((current) => (current === chatId ? null : current))

    setThreads((current) => {
      if (!current[chatId]) {
        return current
      }

      const next = { ...current }
      delete next[chatId]
      return next
    })

    setPrivateChatSessions((current) => {
      if (!current[chatId]) {
        return current
      }

      const next = { ...current }
      delete next[chatId]
      return next
    })

    setRemoteTypingByChatId((current) => {
      if (!current[chatId]) {
        return current
      }

      const next = { ...current }
      delete next[chatId]
      return next
    })

    setReadMarkers((current) => {
      if (!current[chatId]) {
        return current
      }

      const next = { ...current }
      delete next[chatId]
      return next
    })

    setEditingMessage((current) => (current?.chatId === chatId ? null : current))
  }, [])

  const resetRealtimeState = useCallback((
    cleanupReason: string,
    options?: { log?: boolean },
  ) => {
    setStatus('disconnected')
    setIsBootstrapping(false)
    setIsHistoryLoading(false)
    setChats([])
    setRemoteTypingByChatId({})
    setUsers({})
    setThreads({})
    setPrivateChatSessions({})
    setSelectedChatId(null)
    setReadMarkers({})
    setMessageDraft('')
    setEditingMessage(null)
    stopLocalTypingRef.current(undefined, { log: false })

    if (options?.log ?? true) {
      appendEventLog(`Realtime state reset: ${cleanupReason}`)
    }
  }, [appendEventLog])

  const handleUnauthorizedAccess = useCallback((message: string) => {
    socketRef.current?.close()
    socketRef.current = null
    clearAuthState(message)
    resetRealtimeState('unauthorized')
  }, [clearAuthState, resetRealtimeState])

  const handleProtectedRequestError = useCallback((error: unknown, fallbackMessage: string) => {
    if (error instanceof ApiError && error.status === 401) {
      handleUnauthorizedAccess(error.message)
      throw error
    }

    const message = error instanceof Error ? error.message : fallbackMessage
    throw new Error(message)
  }, [handleUnauthorizedAccess])

  const decryptPrivateRecord = useCallback(async (
    message: PrivateMessageRecord,
    nextUserId: string,
    localIdentity: Awaited<ReturnType<typeof loadPrivateChatBrowserIdentity>>,
  ) => {
    const currentUserIds = new Set(
      [
        nextUserId,
        privateChatOwnerIdRef.current,
        ...privateChatOwnerFallbackIdsRef.current,
      ]
        .flatMap((value) => {
          const trimmedValue = value.trim()

          return trimmedValue
            ? [trimmedValue, trimmedValue.toLowerCase()]
            : []
        }),
    )
    const decryptionResult = localIdentity
      ? await decryptPrivateMessage(message.encryptedMessage, localIdentity)
      : ({ status: 'missing-key' } as const)
    const normalizedSenderId = message.senderUserId.trim()
    const effectiveCurrentUserId = currentUserIds.has(normalizedSenderId) ||
      currentUserIds.has(normalizedSenderId.toLowerCase())
      ? message.senderUserId
      : nextUserId

    return toPrivateChatMessage(message, effectiveCurrentUserId, decryptionResult)
  }, [])

  const getPrivateChatKeyId = useCallback(async (accessToken: string) => {
    if (!privateChatFeatureSupported) {
      return null
    }

    const ownerId = privateChatOwnerIdRef.current
    const fallbackOwnerIds = privateChatOwnerFallbackIdsRef.current

    const existingIdentity = await loadPrivateChatBrowserIdentity(
      ownerId,
      fallbackOwnerIds,
    ).catch(() => null)

    if (existingIdentity?.keyId) {
      return existingIdentity.keyId
    }

    if (!accessToken || !ownerId) {
      return null
    }

    const registration = await ensureRegisteredPrivateChatBrowserIdentity(
      serverUrl,
      accessToken,
      ownerId,
      fallbackOwnerIds,
    ).catch(() => null)

    return registration?.identity.keyId ?? null
  }, [privateChatFeatureSupported, serverUrl])

  const hydrateChatSummaries = useCallback(async (
    accessToken: string,
    nextUserId: string,
    chatSummaries: ChatSummary[],
  ) => {
    if (chatSummaries.length === 0) {
      return
    }

    const localPrivateIdentity = privateChatFeatureSupported
      ? await loadPrivateChatBrowserIdentity(
          privateChatOwnerId,
          privateChatOwnerFallbackIds,
        ).catch(() => null)
      : null

    const historyResults = await Promise.allSettled(
      chatSummaries.map(async (chat) => {
        const readMarker = readMarkersRef.current[chat.chatId]

        if ((chat.type ?? 'DIRECT') === 'PRIVATE') {
          if (!localPrivateIdentity) {
            return {
              chatId: chat.chatId,
              preview: '',
              lastMessageTimestamp: undefined,
              unreadCount: 0,
            }
          }

          const messages = await fetchPrivateMessages(
            serverUrl,
            accessToken,
            chat.chatId,
            localPrivateIdentity.keyId,
          )
          const normalizedMessages = await Promise.all(
            messages.map((message) =>
              decryptPrivateRecord(message, nextUserId, localPrivateIdentity),
            ),
          )
          const latestMessage = normalizedMessages.at(-1)

          return {
            chatId: chat.chatId,
            preview: latestMessage?.text ?? '',
            lastMessageTimestamp: latestMessage?.timestamp,
            unreadCount: countUnreadMessages(normalizedMessages, nextUserId, readMarker),
          }
        }

        const messages = filterVisibleMessages(
          await fetchMessages(serverUrl, accessToken, chat.chatId),
        )
        const latestMessage = messages.at(-1)

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
  }, [
    appendEventLog,
    decryptPrivateRecord,
    privateChatFeatureSupported,
    privateChatOwnerFallbackIds,
    privateChatOwnerId,
    serverUrl,
  ])

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

  const enrichOneToOneChats = useCallback(async (
    accessToken: string,
    chatSummaries: ChatSummary[],
  ) => {
    const oneToOneChats = chatSummaries.filter((chat) => (chat.type ?? 'DIRECT') !== 'GROUP')

    if (oneToOneChats.length === 0) {
      return chatSummaries
    }

    const profileResults = await Promise.allSettled(
      oneToOneChats.map(async (chat) => ({
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
        `Could not enrich ${failedProfiles.length} chat profile${failedProfiles.length === 1 ? '' : 's'}.`,
      )
    }

    return chatSummaries.map((chat) => {
      if ((chat.type ?? 'DIRECT') === 'GROUP') {
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
    const keyId = await getPrivateChatKeyId(accessToken)
    const payload = await fetchChats(serverUrl, accessToken, keyId)
    const enrichedPayload = await enrichOneToOneChats(accessToken, payload)

    setChats((current) => mergeFetchedChats(current, enrichedPayload))

    setSelectedChatId((current) => {
      if (current && enrichedPayload.some((chat) => chat.chatId === current)) {
        return current
      }

      return null
    })

    await hydrateChatSummaries(accessToken, nextUserId, enrichedPayload)
  }, [enrichOneToOneChats, getPrivateChatKeyId, hydrateChatSummaries, serverUrl])

  const {
    createPrivateChatForUser,
    handleIncomingPrivateSocketMessage,
    loadPrivateHistory: loadPrivateHistoryForChat,
    sendPrivateMessage,
    setupPrivateChatBrowser,
  } = usePrivateChatManager({
    appendEventLog,
    authSession,
    authStatus,
    chatsRef,
    currentUserId,
    privateChatOwnerFallbackIds,
    privateChatOwnerId,
    decryptPrivateRecord,
    handleUnauthorizedAccess,
    markChatAsRead,
    privateChatFeatureSupported,
    privateChatSessions,
    refreshChats,
    refreshUsers,
    selectedChatIdRef,
    serverUrl,
    setChats,
    setMessageDraft,
    setPrivateChatSessions,
    socketRef,
    stopLocalTypingRef,
    syncChatPreview,
    syncChatTimestamp,
    upsertMessages,
  })

  const loadHistory = useCallback(async (
    chatId: string,
    nextUserId: string,
    options?: LoadHistoryOptions,
  ) => {
    if (!authSession) {
      return
    }

    const didLoadPrivateHistory = await loadPrivateHistoryForChat(chatId, options)

    if (didLoadPrivateHistory) {
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
  }, [
    authSession,
    loadPrivateHistoryForChat,
    markChatAsRead,
    serverUrl,
    syncChatPreview,
    syncChatTimestamp,
    upsertMessages,
  ])

  const handleIncomingDirectSocketMessage = useCallback((
    payload: MessageRecord,
    accessToken: string,
  ) => {
    const message: ChatMessage = {
      ...toChatMessage(payload, userIdRef.current),
      id: toMessageId(payload),
    }

    if (message.senderUserId !== userIdRef.current) {
      clearRemoteTyping(message.chatId)
    }

    const chat = chatsRef.current.find((entry) => entry.chatId === message.chatId)
    upsertMessages(message.chatId, chat?.username ?? message.senderUserId, [message])

    setChats((current) => {
      if (!current.some((entry) => entry.chatId === message.chatId)) {
        void refreshChats(accessToken, userIdRef.current).catch((error) => {
          const messageText = error instanceof Error ? error.message : 'Cannot refresh chats.'
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
  }, [
    appendEventLog,
    clearRemoteTyping,
    markChatAsRead,
    refreshChats,
    upsertMessages,
  ])

  const handleMessageEditEvent = useCallback((payload: MessageRecord) => {
    const editedMessage = toChatMessage(payload, userIdRef.current)

    setThreads((current) => editMessageInThread(current, editedMessage))
    setChats((current) => syncChatAfterMessageEdit(current, editedMessage, threadsRef.current))
    appendEventLog(`Message edited: ${editedMessage.messageId ?? editedMessage.id}`)
  }, [appendEventLog])

  const handleMessageDeleteEvent = useCallback((event: { chatId: string; messageId: string }) => {
    const existingThread = threadsRef.current[event.chatId]

    if (!existingThread) {
      return
    }

    const remainingMessages = existingThread.messages.filter(
      (message) => message.messageId !== event.messageId,
    )

    if (remainingMessages.length === existingThread.messages.length) {
      return
    }

    setThreads((current) => removeMessageFromThread(current, event.chatId, event.messageId))
    setChats((current) => syncChatAfterMessageRemoval(
      current,
      event.chatId,
      remainingMessages,
    ))
    if (editingMessage?.messageId === event.messageId) {
      setMessageDraft(editingMessage.previousDraft)
      setEditingMessage(null)
    }
    appendEventLog(`Message deleted: ${event.messageId}`)
  }, [appendEventLog, editingMessage])

  const {
    acceptCall,
    cleanupCallSession,
    handleCallSignalMessage,
    handleEndSelectedCall,
    handleSelectChat,
    handleStartSelectedCall,
    localCallStream,
    rejectIncomingCall,
    remoteCallStream,
    selectedCallState,
  } = useAppCallCoordinator({
    appendEventLog,
    chatsRef,
    loadHistory,
    selectedChatId,
    selectedChatIdRef,
    setIsHistoryLoading,
    setSelectedChatId,
    socketRef,
    threadsRef,
    userIdRef,
  })

  const handleChatDeleteEvent = useCallback((event: { chatId: string }) => {
    if (selectedChatIdRef.current === event.chatId) {
      cleanupCallSession('chat-deleted')
    }

    removeDeletedChat(event.chatId)
    appendEventLog(`Chat deleted: ${event.chatId}`)
  }, [appendEventLog, cleanupCallSession, removeDeletedChat])

  const { connectAuthenticatedSocket } = useRealtimeConnection({
    appendEventLog,
    appendSystemMessage,
    chatsRef,
    connectAuthenticatedSocketRef,
    currentUserId,
    handleCallSignalMessage,
    handleIncomingDirectSocketMessage,
    handleIncomingPrivateSocketMessage,
    handleChatDeleteEvent,
    handleMessageDeleteEvent,
    handleMessageEditEvent,
    messageDraft,
    onSocketClose: () => {
      cleanupCallSession('socket-closed')
      resetRealtimeState('socket-closed', { log: false })
    },
    onSocketOpen: (accessToken: string, username: string) => {
      setIsBootstrapping(true)
      setReadMarkers(loadReadMarkers(username))

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
    },
    selectedChatId,
    selectedChatIdRef,
    serverUrl,
    socketRef,
    status,
    setRemoteTypingByChatId,
    setStatus,
    setUsers,
    stopLocalTypingRef,
    userIdRef,
  })

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
    appendEventLog('WebRTC component cleanup effect mounted')

    return () => {
      cleanupCallSession('component-unmount')
      socketRef.current?.close()
    }
  }, [appendEventLog, cleanupCallSession])

  const handleConnect = useCallback(() => {
    if (!authSession || !currentUserId) {
      setAuthError('Sign in first to connect the realtime workspace.')
      return
    }

    connectAuthenticatedSocket(authSession.accessToken, currentUserId)
  }, [authSession, connectAuthenticatedSocket, currentUserId, setAuthError])

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

    handleEndSelectedCall()
    stopLocalTypingRef.current(undefined, { log: false })
    socketRef.current?.close()
    socketRef.current = null
    clearAuthState()
    resetRealtimeState('logout')
  }, [
    appendEventLog,
    authSession,
    clearAuthState,
    handleEndSelectedCall,
    resetRealtimeState,
    serverUrl,
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

  const handleCreatePrivateChat = useCallback(async () => {
    if (socketRef.current?.readyState !== WebSocket.OPEN || !authSession) {
      appendEventLog('Connect first.')
      return
    }

    if (!privateChatFeatureSupported) {
      appendEventLog('Private chats need a modern secure browser on this device.')
      return
    }

    const username = newChatUserId.trim().toLowerCase()

    if (!username) {
      appendEventLog('Cannot create private chat without a username.')
      return
    }

    try {
      const chatId = await createPrivateChatForUser(username)

      if (!chatId) {
        return
      }

      setNewChatUserId('')
      setSelectedChatId(chatId)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorizedAccess(error.message)
        return
      }

      const message = error instanceof Error ? error.message : 'Create private chat failed.'
      appendEventLog(`Create private chat failed: ${message}`)
      appendSystemMessage(selectedChatIdRef.current, `Create private chat failed: ${message}`)
    }
  }, [
    appendEventLog,
    appendSystemMessage,
    authSession,
    createPrivateChatForUser,
    handleUnauthorizedAccess,
    newChatUserId,
    privateChatFeatureSupported,
  ])

  const handleSetupPrivateChatBrowser = useCallback(async () => {
    if (!selectedChatSummary || selectedChatSummary.type !== 'PRIVATE' || !currentUserId) {
      return
    }

    setIsHistoryLoading(true)

    try {
      await setupPrivateChatBrowser(selectedChatSummary.chatId)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorizedAccess(error.message)
        return
      }

      const message = error instanceof Error ? error.message : 'Cannot set up private chat.'
      appendEventLog(`Cannot set up private chat: ${message}`)
      setPrivateChatSessions((current) => ({
        ...current,
        [selectedChatSummary.chatId]: {
          ...(current[selectedChatSummary.chatId] ?? DEFAULT_PRIVATE_CHAT_SESSION_STATE),
          accessState: 'error',
          notice: `${PRIVATE_CHAT_ERROR_NOTICE} ${message}`,
        },
      }))
    } finally {
      setIsHistoryLoading(false)
    }
  }, [
    appendEventLog,
    currentUserId,
    handleUnauthorizedAccess,
    selectedChatSummary,
    setupPrivateChatBrowser,
  ])

  const handleStartMessageEdit = useCallback((message: {
    chatId: string
    messageId: string
    text: string
  }) => {
    const existingMessage = threadsRef.current[message.chatId]?.messages.find(
      (item) => item.messageId === message.messageId,
    )

    if (!existingMessage || existingMessage.senderUserId !== userIdRef.current) {
      appendEventLog('Only your own messages can be edited.')
      return
    }

    setEditingMessage((current) => ({
      chatId: message.chatId,
      messageId: message.messageId,
      previousDraft: current?.previousDraft ?? messageDraft,
      text: message.text,
    }))
    setMessageDraft(message.text)
  }, [appendEventLog, messageDraft])

  const handleCancelMessageEdit = useCallback(() => {
    if (!editingMessage) {
      return
    }

    setMessageDraft(editingMessage.previousDraft)
    setEditingMessage(null)
  }, [editingMessage])

  const handleSendMessage = useCallback(async () => {
    const trimmedDraft = messageDraft.trim()

    if (editingMessage) {
      if (!authSession) {
        appendEventLog('Sign in first to edit messages.')
        return
      }

      if (!selectedThread || selectedThread.chatId !== editingMessage.chatId) {
        appendEventLog('Open the edited chat before saving message changes.')
        return
      }

      if (!trimmedDraft) {
        appendEventLog('Enter an updated message before saving.')
        return
      }

      try {
        await editMessage(
          serverUrl,
          authSession.accessToken,
          editingMessage.messageId,
          trimmedDraft,
        )
        appendEventLog(`Edit requested for message ${editingMessage.messageId}.`)
        setMessageDraft(editingMessage.previousDraft)
        setEditingMessage(null)
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          handleUnauthorizedAccess(error.message)
          return
        }

        const message = error instanceof Error ? error.message : 'Edit message failed.'
        appendEventLog(`Edit message failed: ${message}`)
        appendSystemMessage(selectedChatIdRef.current, `Edit message failed: ${message}`)
      }

      return
    }

    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      appendEventLog('Connect first.')
      return
    }

    if (!selectedThread || !trimmedDraft) {
      appendEventLog('Select a chat and enter a message.')
      return
    }

    if (await sendPrivateMessage({ draft: trimmedDraft, selectedThread })) {
      return
    }

    const payload = {
      type: 'MESSAGE' as const,
      chatId: selectedThread.chatId,
      text: trimmedDraft,
    }

    sendWebSocketCommand(socketRef.current, payload)
    appendEventLog(`Sent: ${JSON.stringify(payload)}`)
    stopLocalTypingRef.current(selectedThread.chatId)
    setMessageDraft('')
  }, [
    appendEventLog,
    appendSystemMessage,
    authSession,
    editingMessage,
    handleUnauthorizedAccess,
    messageDraft,
    sendPrivateMessage,
    selectedThread,
    serverUrl,
    stopLocalTypingRef,
  ])

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!authSession) {
      appendEventLog('Sign in first to delete messages.')
      return
    }

    try {
      await deleteMessage(serverUrl, authSession.accessToken, messageId)
      appendEventLog(`Delete requested for message ${messageId}.`)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorizedAccess(error.message)
        return
      }

      const message = error instanceof Error ? error.message : 'Delete message failed.'
      appendEventLog(`Delete message failed: ${message}`)
      appendSystemMessage(selectedChatIdRef.current, `Delete message failed: ${message}`)
    }
  }, [
    appendEventLog,
    appendSystemMessage,
    authSession,
    handleUnauthorizedAccess,
    serverUrl,
  ])

  const handleDeleteChat = useCallback(async (chatId: string) => {
    if (!authSession) {
      appendEventLog('Sign in first to delete chats.')
      return
    }

    const chat = chatsRef.current.find((entry) => entry.chatId === chatId)

    if (!chat) {
      appendEventLog(`Cannot delete missing chat ${chatId}.`)
      return
    }

    if (!canDeleteChat(chat, userIdRef.current)) {
      const message = 'Only the group creator can delete this chat.'
      appendEventLog(message)
      appendSystemMessage(selectedChatIdRef.current, message)
      return
    }

    try {
      await deleteChat(serverUrl, authSession.accessToken, chatId)
      appendEventLog(`Delete requested for chat ${chatId}.`)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorizedAccess(error.message)
        return
      }

      const message = error instanceof Error ? error.message : 'Delete chat failed.'
      appendEventLog(`Delete chat failed: ${message}`)
      appendSystemMessage(selectedChatIdRef.current, `Delete chat failed: ${message}`)
    }
  }, [
    appendEventLog,
    appendSystemMessage,
    authSession,
    handleUnauthorizedAccess,
    serverUrl,
  ])

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
                providerLabel={selectedProviderLabel}
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
              currentUserId,
              isPrivateChatAvailable: privateChatFeatureSupported,
              newChatUserId,
              onCreateDirectChat: handleCreateChat,
              onCreatePrivateChat: handleCreatePrivateChat,
              onDeleteChat: (chatId: string) => {
                void handleDeleteChat(chatId)
              },
              onDisconnect: () => {
                void handleLogout()
              },
              onNewChatUserIdChange: setNewChatUserId,
              onSelectChat: (chatId: string) => {
                handleCancelMessageEdit()
                handleSelectChat(chatId)
              },
              selectedChatId,
              status,
              users,
            }}
            conversationProps={{
              callPhase: selectedCallState?.phase ?? 'idle',
              chatType: selectedChatSummary?.type ?? null,
              connectionStatus: status,
              currentUserId,
              isDrafting,
              isHistoryLoading: isHistoryLoading || isBootstrapping,
              isMobileLayout,
              localCallStream,
              editingMessage: editingMessage
                ? {
                    messageId: editingMessage.messageId,
                    text: editingMessage.text,
                  }
                : null,
              messageDraft,
              onAcceptCall: acceptCall,
              onBackToInbox: () => {
                handleCancelMessageEdit()
                setSelectedChatId(null)
              },
              onDeclineCall: rejectIncomingCall,
              onEndCall: handleEndSelectedCall,
              onMessageDraftChange: setMessageDraft,
              onCancelMessageEdit: handleCancelMessageEdit,
              onDeleteMessage: (messageId: string) => {
                void handleDeleteMessage(messageId)
              },
              onEditMessage: handleStartMessageEdit,
              onSendMessage: handleSendMessage,
              onSetUpPrivateChatBrowser: () => {
                void handleSetupPrivateChatBrowser()
              },
              onStartCall: () => {
                handleStartSelectedCall(selectedThread)
              },
              pendingParticipantName:
                selectedThread?.participant ?? selectedChatSummary?.username ?? null,
              participantProfile: selectedChatSummary,
              privateChatState: selectedPrivateChatSession,
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
