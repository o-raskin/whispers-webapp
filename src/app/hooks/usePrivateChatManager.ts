import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react'
import { sendWebSocketCommand } from '../../shared/api/chatApi'
import { ApiError } from '../../shared/api/apiClient'
import {
  createPrivateChat,
  fetchPrivateChat,
  fetchPrivateMessages,
} from '../../shared/api/privateChatApi'
import {
  encryptPrivateMessage,
  importPrivateChatPublicKey,
} from '../../shared/private-chat/privateChatCrypto'
import {
  ensureRegisteredPrivateChatBrowserIdentity,
  loadPrivateChatBrowserIdentity,
  registerPrivateChatBrowserIdentity,
} from '../../shared/private-chat/privateChatService'
import type { AuthSession } from '../../shared/types/auth'
import type {
  ChatMessage,
  ChatSummary,
  ChatThread,
  PrivateMessageRecord,
} from '../../shared/types/chat'
import type { AuthStatus } from '../utils/authFlow'
import { applyIncomingMessageToChats } from '../utils/chatRuntime'
import {
  DEFAULT_PRIVATE_CHAT_SESSION_STATE,
  PRIVATE_CHAT_ERROR_NOTICE,
  PRIVATE_CHAT_MISSING_KEY_NOTICE,
  PRIVATE_CHAT_READY_NOTICE,
  PRIVATE_CHAT_SETUP_NOTICE,
  type PrivateChatSessionState,
} from '../utils/privateChatRuntime'
import type { StopLocalTyping } from './useRealtimeConnection'

const PRIVATE_CHAT_UNSUPPORTED_NOTICE =
  'Private chats need a modern secure browser on this device.'

interface LoadPrivateHistoryOptions {
  allowPrivateKeySetup?: boolean
}

interface SendPrivateMessageArgs {
  draft: string
  selectedThread: ChatThread | null
}

interface UsePrivateChatManagerArgs {
  appendEventLog: (message: string) => void
  authSession: AuthSession | null
  authStatus: AuthStatus
  chatsRef: MutableRefObject<ChatSummary[]>
  currentUserId: string
  decryptPrivateRecord: (
    message: PrivateMessageRecord,
    nextUserId: string,
    localIdentity: Awaited<ReturnType<typeof loadPrivateChatBrowserIdentity>>,
  ) => Promise<ChatMessage>
  handleUnauthorizedAccess: (message: string) => void
  markChatAsRead: (chatId: string, timestamp: string | null | undefined) => void
  privateChatFeatureSupported: boolean
  privateChatSessions: Record<string, PrivateChatSessionState>
  refreshChats: (accessToken: string, nextUserId: string) => Promise<void>
  refreshUsers: (accessToken: string) => Promise<void>
  selectedChatIdRef: MutableRefObject<string | null>
  serverUrl: string
  setChats: Dispatch<SetStateAction<ChatSummary[]>>
  setMessageDraft: Dispatch<SetStateAction<string>>
  setPrivateChatSessions: Dispatch<
    SetStateAction<Record<string, PrivateChatSessionState>>
  >
  socketRef: MutableRefObject<WebSocket | null>
  stopLocalTypingRef: MutableRefObject<StopLocalTyping>
  syncChatPreview: (chatId: string, preview: string) => void
  syncChatTimestamp: (chatId: string, lastMessageTimestamp: string) => void
  upsertMessages: (
    chatId: string,
    participant: string,
    incomingMessages: ChatMessage[],
  ) => void
}

export function usePrivateChatManager({
  appendEventLog,
  authSession,
  authStatus,
  chatsRef,
  currentUserId,
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
}: UsePrivateChatManagerArgs) {
  const privateKeyBootstrapRef = useRef<string | null>(null)

  const updatePrivateChatSession = useCallback((
    chatId: string,
    updater: (
      current: PrivateChatSessionState,
    ) => PrivateChatSessionState,
  ) => {
    setPrivateChatSessions((current) => ({
      ...current,
      [chatId]: updater(current[chatId] ?? DEFAULT_PRIVATE_CHAT_SESSION_STATE),
    }))
  }, [setPrivateChatSessions])

  useEffect(() => {
    if (
      authStatus !== 'authenticated' ||
      !authSession ||
      !currentUserId ||
      !privateChatFeatureSupported
    ) {
      privateKeyBootstrapRef.current = null
      return
    }

    const bootstrapKey = `${serverUrl}|${currentUserId}|${authSession.accessToken}`

    if (privateKeyBootstrapRef.current === bootstrapKey) {
      return
    }

    privateKeyBootstrapRef.current = bootstrapKey

    let isCancelled = false

    void ensureRegisteredPrivateChatBrowserIdentity(
      serverUrl,
      authSession.accessToken,
      currentUserId,
    )
      .then(() => {
        if (isCancelled) {
          return
        }

        appendEventLog(`Private browser key ready for ${currentUserId}.`)
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return
        }

        privateKeyBootstrapRef.current = null

        if (error instanceof ApiError && error.status === 401) {
          handleUnauthorizedAccess(error.message)
          return
        }

        const message =
          error instanceof Error ? error.message : 'Could not register the private browser key.'
        appendEventLog(`Private key registration skipped: ${message}`)
      })

    return () => {
      isCancelled = true
    }
  }, [
    appendEventLog,
    authSession,
    authStatus,
    currentUserId,
    handleUnauthorizedAccess,
    privateChatFeatureSupported,
    serverUrl,
  ])

  const loadPrivateHistory = useCallback(async (
    chatId: string,
    options?: LoadPrivateHistoryOptions,
  ) => {
    const chat = chatsRef.current.find((entry) => entry.chatId === chatId)

    if (!chat || (chat.type ?? 'DIRECT') !== 'PRIVATE') {
      return false
    }

    if (!authSession || !currentUserId) {
      return true
    }

    upsertMessages(chatId, chat.username, [])

    if (!privateChatFeatureSupported) {
      updatePrivateChatSession(chatId, () => ({
        accessState: 'error',
        metadata: null,
        notice: PRIVATE_CHAT_UNSUPPORTED_NOTICE,
      }))
      return true
    }

    updatePrivateChatSession(chatId, (current) => ({
      ...current,
      accessState: options?.allowPrivateKeySetup ? 'setting-up' : 'loading',
    }))

    let localIdentity = await loadPrivateChatBrowserIdentity(currentUserId)

    if (!localIdentity && options?.allowPrivateKeySetup) {
      const registration = await ensureRegisteredPrivateChatBrowserIdentity(
        serverUrl,
        authSession.accessToken,
        currentUserId,
      )

      localIdentity = registration.identity
    }

    let metadata = localIdentity
      ? await fetchPrivateChat(
          serverUrl,
          authSession.accessToken,
          chatId,
          localIdentity.keyId,
        )
      : null

    if (localIdentity && metadata && metadata.currentUserKey.keyId !== localIdentity.keyId) {
      await registerPrivateChatBrowserIdentity(
        serverUrl,
        authSession.accessToken,
        localIdentity,
      )
      metadata = await fetchPrivateChat(
        serverUrl,
        authSession.accessToken,
        chatId,
        localIdentity.keyId,
      )
    }

    const payload = localIdentity
      ? await fetchPrivateMessages(
          serverUrl,
          authSession.accessToken,
          chatId,
          localIdentity.keyId,
        )
      : []
    const normalizedMessages = await Promise.all(
      payload.map((message) => decryptPrivateRecord(message, currentUserId, localIdentity)),
    )
    const latestMessage = normalizedMessages.at(-1)
    const hasLockedHistory = normalizedMessages.some(
      (message) => message.encryption?.state === 'missing-key',
    )

    upsertMessages(chatId, chat.username, normalizedMessages)
    syncChatPreview(chatId, latestMessage?.text ?? '')

    if (latestMessage) {
      syncChatTimestamp(chatId, latestMessage.timestamp)
      markChatAsRead(chatId, latestMessage.timestamp)
    }

    updatePrivateChatSession(chatId, () => ({
      accessState: localIdentity ? 'ready' : 'missing-key',
      metadata: metadata ?? null,
      notice: localIdentity
        ? hasLockedHistory
          ? `${PRIVATE_CHAT_READY_NOTICE} Some earlier messages are still locked to a different browser key.`
          : PRIVATE_CHAT_READY_NOTICE
        : `${PRIVATE_CHAT_MISSING_KEY_NOTICE} ${PRIVATE_CHAT_SETUP_NOTICE}`,
    }))

    return true
  }, [
    authSession,
    chatsRef,
    currentUserId,
    decryptPrivateRecord,
    markChatAsRead,
    privateChatFeatureSupported,
    serverUrl,
    syncChatPreview,
    syncChatTimestamp,
    updatePrivateChatSession,
    upsertMessages,
  ])

  const handleIncomingPrivateSocketMessage = useCallback(async (
    message: PrivateMessageRecord,
    accessToken: string,
  ) => {
    const localIdentity = privateChatFeatureSupported
      ? await loadPrivateChatBrowserIdentity(currentUserId).catch(() => null)
      : null
    const normalizedMessage = await decryptPrivateRecord(
      message,
      currentUserId,
      localIdentity,
    )

    updatePrivateChatSession(normalizedMessage.chatId, (current) => ({
      ...current,
      accessState: localIdentity
        ? 'ready'
        : privateChatFeatureSupported
          ? 'missing-key'
          : 'error',
      notice: localIdentity
        ? current.notice ?? PRIVATE_CHAT_READY_NOTICE
        : privateChatFeatureSupported
          ? current.notice ?? `${PRIVATE_CHAT_MISSING_KEY_NOTICE} ${PRIVATE_CHAT_SETUP_NOTICE}`
          : current.notice ?? PRIVATE_CHAT_UNSUPPORTED_NOTICE,
    }))

    const chat = chatsRef.current.find((entry) => entry.chatId === normalizedMessage.chatId)
    upsertMessages(
      normalizedMessage.chatId,
      chat?.username ?? normalizedMessage.senderUserId,
      [normalizedMessage],
    )

    if (!chat) {
      await refreshChats(accessToken, currentUserId).catch((error) => {
        const messageText = error instanceof Error ? error.message : 'Cannot refresh chats.'
        appendEventLog(`Cannot refresh chats: ${messageText}`)
      })
      return
    }

    if (selectedChatIdRef.current === normalizedMessage.chatId) {
      markChatAsRead(normalizedMessage.chatId, normalizedMessage.timestamp)
    }

    setChats((current) =>
      applyIncomingMessageToChats(
        current,
        normalizedMessage,
        selectedChatIdRef.current,
        currentUserId,
      ) ?? current,
    )
  }, [
    appendEventLog,
    chatsRef,
    currentUserId,
    decryptPrivateRecord,
    markChatAsRead,
    privateChatFeatureSupported,
    refreshChats,
    selectedChatIdRef,
    setChats,
    updatePrivateChatSession,
    upsertMessages,
  ])

  const createPrivateChatForUser = useCallback(async (username: string) => {
    if (!authSession || !currentUserId) {
      appendEventLog('Connect first.')
      return null
    }

    if (!privateChatFeatureSupported) {
      appendEventLog(PRIVATE_CHAT_UNSUPPORTED_NOTICE)
      return null
    }

    let localIdentity = await loadPrivateChatBrowserIdentity(currentUserId)

    if (!localIdentity) {
      const registration = await ensureRegisteredPrivateChatBrowserIdentity(
        serverUrl,
        authSession.accessToken,
        currentUserId,
      )
      localIdentity = registration.identity
    }

    const chat = await createPrivateChat(
      serverUrl,
      authSession.accessToken,
      username,
      localIdentity.keyId,
    )
    appendEventLog(`Private chat ready: ${chat.chatId}`)

    await Promise.all([
      refreshChats(authSession.accessToken, currentUserId),
      refreshUsers(authSession.accessToken),
    ])

    return chat.chatId
  }, [
    appendEventLog,
    authSession,
    currentUserId,
    privateChatFeatureSupported,
    refreshChats,
    refreshUsers,
    serverUrl,
  ])

  const setupPrivateChatBrowser = useCallback(async (chatId: string) => {
    const didHandlePrivateHistory = await loadPrivateHistory(chatId, {
      allowPrivateKeySetup: true,
    })

    if (!didHandlePrivateHistory) {
      return
    }
  }, [loadPrivateHistory])

  const sendPrivateMessage = useCallback(async ({
    draft,
    selectedThread,
  }: SendPrivateMessageArgs) => {
    if (!selectedThread) {
      return false
    }

    const chat = chatsRef.current.find((entry) => entry.chatId === selectedThread.chatId)

    if (!chat || (chat.type ?? 'DIRECT') !== 'PRIVATE') {
      return false
    }

    const trimmedDraft = draft.trim()

    if (!trimmedDraft) {
      appendEventLog('Select a chat and enter a message.')
      return true
    }

    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      appendEventLog('Connect first.')
      return true
    }

    if (!authSession || !currentUserId) {
      appendEventLog('Sign back in before sending a private message.')
      return true
    }

    if (!privateChatFeatureSupported) {
      updatePrivateChatSession(selectedThread.chatId, () => ({
        accessState: 'error',
        metadata: null,
        notice: PRIVATE_CHAT_UNSUPPORTED_NOTICE,
      }))
      appendEventLog(PRIVATE_CHAT_UNSUPPORTED_NOTICE)
      return true
    }

    try {
      let localIdentity = await loadPrivateChatBrowserIdentity(currentUserId)

      if (!localIdentity) {
        await loadPrivateHistory(selectedThread.chatId, {
          allowPrivateKeySetup: true,
        })
        localIdentity = await loadPrivateChatBrowserIdentity(currentUserId)
      }

      if (!localIdentity) {
        appendEventLog('Set up this browser before sending private messages.')
        return true
      }

      let metadata = privateChatSessions[selectedThread.chatId]?.metadata

      if (!metadata) {
        metadata = await fetchPrivateChat(
          serverUrl,
          authSession.accessToken,
          selectedThread.chatId,
          localIdentity.keyId,
        )
      }

      if (metadata.currentUserKey.keyId !== localIdentity.keyId) {
        await registerPrivateChatBrowserIdentity(
          serverUrl,
          authSession.accessToken,
          localIdentity,
        )
        metadata = await fetchPrivateChat(
          serverUrl,
          authSession.accessToken,
          selectedThread.chatId,
          localIdentity.keyId,
        )
      }

      const recipientPublicKey = await importPrivateChatPublicKey(
        metadata.counterpartKey.publicKey,
      )
      const privateMessage = await encryptPrivateMessage({
        text: trimmedDraft,
        senderIdentity: localIdentity,
        recipientKeyId: metadata.counterpartKey.keyId,
        recipientPublicKey,
      })

      sendWebSocketCommand(socketRef.current, {
        type: 'PRIVATE_MESSAGE',
        chatId: selectedThread.chatId,
        privateMessage,
      })
      updatePrivateChatSession(selectedThread.chatId, (current) => ({
        ...current,
        accessState: 'ready',
        metadata,
        notice: current.notice ?? PRIVATE_CHAT_READY_NOTICE,
      }))
      appendEventLog(`Sent private message in ${selectedThread.chatId}.`)
      stopLocalTypingRef.current(selectedThread.chatId)
      setMessageDraft('')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorizedAccess(error.message)
        return true
      }

      const message = error instanceof Error ? error.message : 'Send private message failed.'
      appendEventLog(`Send private message failed: ${message}`)
      updatePrivateChatSession(selectedThread.chatId, (current) => ({
        ...current,
        accessState: 'error',
        notice: `${PRIVATE_CHAT_ERROR_NOTICE} ${message}`,
      }))
    }

    return true
  }, [
    appendEventLog,
    authSession,
    chatsRef,
    currentUserId,
    handleUnauthorizedAccess,
    loadPrivateHistory,
    privateChatFeatureSupported,
    privateChatSessions,
    serverUrl,
    setMessageDraft,
    socketRef,
    stopLocalTypingRef,
    updatePrivateChatSession,
  ])

  return {
    createPrivateChatForUser,
    handleIncomingPrivateSocketMessage,
    loadPrivateHistory,
    sendPrivateMessage,
    setupPrivateChatBrowser,
  }
}
