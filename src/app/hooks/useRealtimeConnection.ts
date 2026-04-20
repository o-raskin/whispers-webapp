import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react'
import {
  buildWebSocketProtocols,
  buildWebSocketUrl,
  sendWebSocketCommand,
} from '../../shared/api/chatApi'
import { PRESENCE_PING_INTERVAL_MS } from '../../shared/config/backend'
import type {
  CallSignalPayload,
  ChatSummary,
  ConnectionStatus,
  MessageRecord,
  PingCommand,
  PrivateMessageRecord,
  TypingCommand,
  UserPresence,
} from '../../shared/types/chat'
import { isCallSignalText, parseCallSignalText } from '../../shared/utils/callSignals'
import { normalizeSocketPrivateMessage } from '../utils/privateChatRuntime'
import {
  hasTypedEventShape,
  isMessageRecord,
  isPrivateMessageRecord,
  isPresenceEvent,
  isTypingEvent,
  type WebSocketMessageRecordPayload,
} from '../utils/websocketPayloadGuards'

const TYPING_REFRESH_INTERVAL_MS = 4000

export type StopLocalTyping = (
  chatId?: string | null,
  options?: { log?: boolean },
) => void

interface UseRealtimeConnectionArgs {
  appendEventLog: (message: string) => void
  appendSystemMessage: (chatId: string | null, text: string) => void
  chatsRef: MutableRefObject<ChatSummary[]>
  connectAuthenticatedSocketRef: MutableRefObject<
    (accessToken: string, username: string) => void
  >
  currentUserId: string
  handleCallSignalMessage: (
    message: MessageRecord,
    signal: CallSignalPayload,
  ) => Promise<void> | void
  handleIncomingDirectSocketMessage: (
    message: MessageRecord,
    accessToken: string,
  ) => void
  handleIncomingPrivateSocketMessage: (
    message: PrivateMessageRecord,
    accessToken: string,
  ) => Promise<void> | void
  messageDraft: string
  onSocketClose: () => void
  onSocketOpen: (accessToken: string, username: string) => void
  selectedChatId: string | null
  selectedChatIdRef: MutableRefObject<string | null>
  serverUrl: string
  socketRef: MutableRefObject<WebSocket | null>
  status: ConnectionStatus
  setRemoteTypingByChatId: Dispatch<SetStateAction<Record<string, string>>>
  setStatus: Dispatch<SetStateAction<ConnectionStatus>>
  setUsers: Dispatch<SetStateAction<Record<string, UserPresence>>>
  stopLocalTypingRef: MutableRefObject<StopLocalTyping>
  userIdRef: MutableRefObject<string>
}

function normalizeSocketMessage(payload: WebSocketMessageRecordPayload): MessageRecord {
  return {
    ...payload,
    chatId: String(payload.chatId),
  }
}

export function useRealtimeConnection({
  appendEventLog,
  appendSystemMessage,
  chatsRef,
  connectAuthenticatedSocketRef,
  currentUserId,
  handleCallSignalMessage,
  handleIncomingDirectSocketMessage,
  handleIncomingPrivateSocketMessage,
  messageDraft,
  onSocketClose,
  onSocketOpen,
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
}: UseRealtimeConnectionArgs) {
  const pingTimerRef = useRef<number | null>(null)
  const typingTimerRef = useRef<number | null>(null)
  const activeTypingChatIdRef = useRef<string | null>(null)

  const clearRemoteTyping = useCallback((chatId: string) => {
    setRemoteTypingByChatId((current) => {
      if (!current[chatId]) {
        return current
      }

      const next = { ...current }
      delete next[chatId]
      return next
    })
  }, [setRemoteTypingByChatId])

  const clearTypingRefreshTimer = useCallback(() => {
    if (typingTimerRef.current !== null) {
      window.clearInterval(typingTimerRef.current)
      typingTimerRef.current = null
    }
  }, [])

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
  }, [appendEventLog, socketRef])

  const startLocalTyping = useCallback((chatId: string, options?: { log?: boolean }) => {
    const didSend = sendTypingCommand({ type: 'TYPING_START', chatId }, options)
    activeTypingChatIdRef.current = didSend ? chatId : null
    return didSend
  }, [sendTypingCommand])

  const stopLocalTyping = useCallback<StopLocalTyping>((chatId = activeTypingChatIdRef.current, options) => {
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
      appendEventLog(`WebSocket connected as ${username}.`)
      onSocketOpen(accessToken, username)
    }

    socket.onmessage = (event) => {
      const raw = String(event.data)

      if (raw.startsWith('CONNECTED:')) {
        return
      }

      if (raw.startsWith('ERROR:')) {
        appendSystemMessage(selectedChatIdRef.current, raw)
        return
      }

      let payload: unknown

      try {
        payload = JSON.parse(raw)
      } catch {
        appendEventLog(`Ignored non-JSON message: ${raw}`)
        return
      }

      if (isPrivateMessageRecord(payload)) {
        appendEventLog(`Received private message for chat ${String(payload.chatId)}.`)

        if (payload.senderUsername !== userIdRef.current) {
          clearRemoteTyping(String(payload.chatId))
        }

        void handleIncomingPrivateSocketMessage(
          normalizeSocketPrivateMessage(payload),
          accessToken,
        )
        return
      }

      appendEventLog(`Received: ${raw}`)

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

        handleIncomingDirectSocketMessage(normalizedPayload, accessToken)
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
      clearTypingRefreshTimer()
      activeTypingChatIdRef.current = null
      socketRef.current = null
      onSocketClose()
    }
  }, [
    appendEventLog,
    appendSystemMessage,
    chatsRef,
    clearRemoteTyping,
    clearTypingRefreshTimer,
    handleCallSignalMessage,
    handleIncomingDirectSocketMessage,
    handleIncomingPrivateSocketMessage,
    onSocketClose,
    onSocketOpen,
    selectedChatIdRef,
    serverUrl,
    setRemoteTypingByChatId,
    setStatus,
    setUsers,
    socketRef,
    userIdRef,
  ])

  useLayoutEffect(() => {
    connectAuthenticatedSocketRef.current = connectAuthenticatedSocket
    stopLocalTypingRef.current = stopLocalTyping
  }, [connectAuthenticatedSocket, connectAuthenticatedSocketRef, stopLocalTyping, stopLocalTypingRef])

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
  }, [appendEventLog, currentUserId, socketRef, status])

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

  useEffect(() => () => {
    if (pingTimerRef.current !== null) {
      window.clearInterval(pingTimerRef.current)
    }

    clearTypingRefreshTimer()
    socketRef.current?.close()
  }, [clearTypingRefreshTimer, socketRef])

  return {
    connectAuthenticatedSocket,
    stopLocalTyping,
  }
}
