import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { ChatSidebar } from '../features/chat-list/components/ChatSidebar'
import { ConnectionPanel } from '../features/connection/components/ConnectionPanel'
import { ConversationPanel } from '../features/conversation/components/ConversationPanel'
import { EventLogPanel } from '../features/event-log/components/EventLogPanel'
import { WelcomeExperience } from '../features/welcome/components/WelcomeExperience'
import { toChatMessage, toMessageId } from '../shared/adapters/chatAdapters'
import {
  buildWebSocketUrl,
  createChat,
  fetchChats,
  fetchMessages,
  fetchUsers,
  sendWebSocketCommand,
} from '../shared/api/chatApi'
import {
  DEFAULT_WS_URL,
  PRESENCE_PING_INTERVAL_MS,
} from '../shared/config/backend'
import type {
  ChatSummary,
  ChatThread,
  ChatMessage,
  ConnectionStatus,
  PingCommand,
  SendMessageCommand,
  TypingCommand,
  UserPresence,
  WebSocketIncomingEvent,
} from '../shared/types/chat'
import { panelTransition, shellStagger } from '../shared/motion/presets'
import {
  appendLog,
  countUnreadMessages,
  hasTypedEventShape,
  isMessageRecord,
  isPresenceEvent,
  isTypingEvent,
  loadReadMarkers,
  saveReadMarkers,
} from './appTestUtils'

const TYPING_REFRESH_INTERVAL_MS = 4000
const MOBILE_LAYOUT_MEDIA_QUERY = '(max-width: 760px)'

export function App() {
  const socketRef = useRef<WebSocket | null>(null)
  const pingTimerRef = useRef<number | null>(null)
  const typingTimerRef = useRef<number | null>(null)
  const activeTypingChatIdRef = useRef<string | null>(null)
  const userIdRef = useRef('')
  const chatsRef = useRef<ChatSummary[]>([])
  const selectedChatIdRef = useRef<string | null>(null)
  const readMarkersRef = useRef<Record<string, string>>({})

  const [serverUrl, setServerUrl] = useState(DEFAULT_WS_URL)
  const [userId, setUserId] = useState('')
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [users, setUsers] = useState<Record<string, UserPresence>>({})
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [threads, setThreads] = useState<Record<string, ChatThread>>({})
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [newChatUserId, setNewChatUserId] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY).matches
      : false,
  )
  const [remoteTypingByChatId, setRemoteTypingByChatId] = useState<Record<string, string>>({})
  const [readMarkers, setReadMarkers] = useState<Record<string, string>>({})
  const [eventLog, setEventLog] = useState<string[]>([
    '[09:00:12] Client initialized from swagger contract.',
  ])

  const selectedThread = selectedChatId ? threads[selectedChatId] ?? null : null
  const selectedUser = selectedThread ? users[selectedThread.participant] ?? null : null
  const remoteTypingLabel = selectedChatId ? remoteTypingByChatId[selectedChatId] ?? null : null
  const showWelcome = status !== 'connected'
  const isDrafting = Boolean(messageDraft.trim())
  const isMobileChatOpen = isMobileLayout && Boolean(selectedChatId)

  userIdRef.current = userId.trim()
  chatsRef.current = chats
  selectedChatIdRef.current = selectedChatId
  readMarkersRef.current = readMarkers

  const clearTypingRefreshTimer = useCallback(() => {
    if (typingTimerRef.current !== null) {
      window.clearInterval(typingTimerRef.current)
      typingTimerRef.current = null
    }
  }, [])

  const sendTypingCommand = useCallback((
    payload: TypingCommand,
    options?: { log?: boolean },
  ): boolean => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      return false
    }

    sendWebSocketCommand(socketRef.current, payload)

    if (options?.log ?? true) {
      setEventLog((current) => appendLog(current, `Sent: ${JSON.stringify(payload)}`))
    }

    return true
  }, [])

  const startLocalTyping = useCallback((
    chatId: string,
    options?: { log?: boolean },
  ): boolean => {
    const didSend = sendTypingCommand(
      {
        type: 'TYPING_START',
        chatId,
      },
      options,
    )

    activeTypingChatIdRef.current = didSend ? chatId : null
    return didSend
  }, [sendTypingCommand])

  const stopLocalTyping = useCallback((
    chatId = activeTypingChatIdRef.current,
    options?: { log?: boolean },
  ) => {
    clearTypingRefreshTimer()
    activeTypingChatIdRef.current = null

    if (!chatId) {
      return
    }

    void sendTypingCommand(
      {
        type: 'TYPING_END',
        chatId,
      },
      options,
    )
  }, [clearTypingRefreshTimer, sendTypingCommand])

  const appendSystemMessage = useCallback((chatId: string | null, text: string) => {
    if (!chatId) {
      return
    }

    const systemMessage: ChatMessage = {
      id: `system-${chatId}-${Date.now()}`,
      chatId,
      senderUserId: 'system',
      direction: 'system',
      text,
      timestamp: new Date().toISOString(),
    }

    setThreads((current) => {
      const existing = current[chatId]
      if (!existing) {
        return current
      }

      return {
        ...current,
        [chatId]: {
          ...existing,
          messages: [...existing.messages, systemMessage],
        },
      }
    })
  }, [])

  const upsertMessages = useCallback((
    chatId: string,
    participant: string,
    incomingMessages: ChatMessage[],
  ) => {
    setThreads((current) => {
      const existing = current[chatId]
      const seen = new Set(existing?.messages.map((message) => message.id) ?? [])
      const merged = existing?.messages ? [...existing.messages] : []

      for (const message of incomingMessages) {
        if (!seen.has(message.id)) {
          seen.add(message.id)
          merged.push(message)
        }
      }

      merged.sort((left, right) => left.timestamp.localeCompare(right.timestamp))

      return {
        ...current,
        [chatId]: {
          chatId,
          participant,
          messages: merged,
        },
      }
    })
  }, [])

  const syncChatPreview = useCallback((chatId: string, preview: string) => {
    setChats((current) =>
      current.map((chat) => (chat.chatId === chatId ? { ...chat, preview } : chat)),
    )
  }, [])

  const syncChatTimestamp = useCallback((chatId: string, lastMessageTimestamp: string) => {
    setChats((current) =>
      current.map((chat) =>
        chat.chatId === chatId ? { ...chat, lastMessageTimestamp } : chat,
      ),
    )
  }, [])

  const markChatAsRead = useCallback((
    chatId: string,
    timestamp: string | null | undefined,
  ) => {
    if (!timestamp) {
      return
    }

    setReadMarkers((current) => {
      const existing = current[chatId]

      if (existing && existing.localeCompare(timestamp) >= 0) {
        return current
      }

      return {
        ...current,
        [chatId]: timestamp,
      }
    })

    setChats((current) =>
      current.map((chat) =>
        chat.chatId === chatId ? { ...chat, unreadCount: 0 } : chat,
      ),
    )
  }, [])

  const handleSelectChat = useCallback((chatId: string) => {
    setSelectedChatId(chatId)
    setIsHistoryLoading(true)
  }, [])

  const hydrateChatSummaries = useCallback(async (
    currentUserId: string,
    chatSummaries: ChatSummary[],
  ) => {
    if (chatSummaries.length === 0) {
      return
    }

    const historyResults = await Promise.allSettled(
      chatSummaries.map(async (chat) => {
        const payload = await fetchMessages(serverUrl, currentUserId, chat.chatId)
        const latestMessage = payload.at(-1)
        const readMarker = readMarkersRef.current[chat.chatId]

        return {
          chatId: chat.chatId,
          preview: latestMessage?.text ?? '',
          lastMessageTimestamp: latestMessage?.timestamp,
          unreadCount: countUnreadMessages(payload, currentUserId, readMarker),
        }
      }),
    )

    const failedChats = historyResults.filter((result) => result.status === 'rejected')

    if (failedChats.length > 0) {
      setEventLog((current) =>
        appendLog(
          current,
          `Could not hydrate ${failedChats.length} chat preview${failedChats.length === 1 ? '' : 's'} during login.`,
        ),
      )
    }

    const nextByChatId = new Map<
      string,
      { preview: string; lastMessageTimestamp?: string; unreadCount: number }
    >()

    for (const result of historyResults) {
      if (result.status === 'fulfilled') {
        nextByChatId.set(result.value.chatId, {
          preview: result.value.preview,
          lastMessageTimestamp: result.value.lastMessageTimestamp,
          unreadCount: result.value.unreadCount,
        })
      }
    }

    setChats((current) =>
      current.map((chat) => {
        const hydrated = nextByChatId.get(chat.chatId)

        if (!hydrated) {
          return chat
        }

        const shouldKeepExistingTimestamp =
          Boolean(chat.lastMessageTimestamp) &&
          Boolean(hydrated.lastMessageTimestamp) &&
          chat.lastMessageTimestamp!.localeCompare(hydrated.lastMessageTimestamp!) > 0

        if (shouldKeepExistingTimestamp) {
          return chat
        }

        return {
          ...chat,
          preview: hydrated.preview || chat.preview,
          lastMessageTimestamp: hydrated.lastMessageTimestamp ?? chat.lastMessageTimestamp,
          unreadCount:
            selectedChatIdRef.current === chat.chatId ? 0 : hydrated.unreadCount,
        }
      }),
    )
  }, [serverUrl])

  const refreshUsers = useCallback(async (currentUserId: string) => {
    const payload = await fetchUsers(serverUrl, currentUserId)

    setUsers((current) => {
      const next: Record<string, UserPresence> = {}

      for (const user of payload) {
        next[user.username] = {
          ...user,
          lastPingReceivedAt: current[user.username]?.lastPingReceivedAt ?? null,
        }
      }

      return next
    })
  }, [serverUrl])

  const refreshChats = useCallback(async (currentUserId: string) => {
    const payload = await fetchChats(serverUrl, currentUserId)

    setChats((current) =>
      payload.map((chat) => {
        const existing = current.find((item) => item.chatId === chat.chatId)
        return {
          ...chat,
          preview: chat.preview ?? existing?.preview,
          lastMessageTimestamp: chat.lastMessageTimestamp ?? existing?.lastMessageTimestamp,
          unreadCount: existing?.unreadCount ?? 0,
        }
      }),
    )

    setSelectedChatId((current) => {
      if (current && payload.some((chat) => chat.chatId === current)) {
        return current
      }

      return null
    })

    await hydrateChatSummaries(currentUserId, payload)
  }, [hydrateChatSummaries, serverUrl])

  const loadHistory = useCallback(async (chatId: string, currentUserId: string) => {
    const chat = chatsRef.current.find((entry) => entry.chatId === chatId)
    if (!chat) {
      return
    }

    const payload = await fetchMessages(serverUrl, currentUserId, chatId)
    const normalized = payload.map((message) => toChatMessage(message, currentUserId))
    const latestMessage = normalized.at(-1)

    upsertMessages(chatId, chat.username, normalized)
    syncChatPreview(chatId, latestMessage?.text ?? '')

    if (latestMessage) {
      syncChatTimestamp(chatId, latestMessage.timestamp)
      markChatAsRead(chatId, latestMessage.timestamp)
    }
  }, [markChatAsRead, serverUrl, syncChatPreview, syncChatTimestamp, upsertMessages])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY)
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileLayout(event.matches)
    }

    setIsMobileLayout(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const root = document.documentElement
    const viewport = window.visualViewport

    const syncVisibleViewport = () => {
      const visibleHeight = viewport?.height ?? window.innerHeight
      const visibleOffsetTop = viewport?.offsetTop ?? 0

      root.style.setProperty('--app-visible-height', `${visibleHeight}px`)
      root.style.setProperty('--app-visible-offset-top', `${visibleOffsetTop}px`)
    }

    syncVisibleViewport()

    viewport?.addEventListener('resize', syncVisibleViewport)
    viewport?.addEventListener('scroll', syncVisibleViewport)
    window.addEventListener('resize', syncVisibleViewport)

    return () => {
      viewport?.removeEventListener('resize', syncVisibleViewport)
      viewport?.removeEventListener('scroll', syncVisibleViewport)
      window.removeEventListener('resize', syncVisibleViewport)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (pingTimerRef.current !== null) {
        window.clearInterval(pingTimerRef.current)
      }

      clearTypingRefreshTimer()

      socketRef.current?.close()
    }
  }, [clearTypingRefreshTimer])

  useEffect(() => {
    const currentUserId = userId.trim()

    if (!currentUserId) {
      return
    }

    saveReadMarkers(currentUserId, readMarkers)
  }, [readMarkers, userId])

  useEffect(() => {
    const currentUserId = userId.trim()

    if (!selectedChatId || !currentUserId) {
      return
    }

    setIsHistoryLoading(true)
    loadHistory(selectedChatId, currentUserId).catch((error: Error) => {
      setEventLog((current) => appendLog(current, `Cannot load history: ${error.message}`))
      appendSystemMessage(selectedChatId, `Cannot load history: ${error.message}`)
    }).finally(() => {
      setIsHistoryLoading(false)
    })
  }, [appendSystemMessage, loadHistory, selectedChatId, userId])

  useEffect(() => {
    if (status !== 'connected' || !userId.trim()) {
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
      setEventLog((current) => appendLog(current, `Sent: ${JSON.stringify(pingPayload)}`))
    }

    runPing()
    pingTimerRef.current = window.setInterval(runPing, PRESENCE_PING_INTERVAL_MS)

    return () => {
      if (pingTimerRef.current !== null) {
        window.clearInterval(pingTimerRef.current)
        pingTimerRef.current = null
      }
    }
  }, [serverUrl, status, userId])

  useEffect(() => {
    const nextChatId = selectedChatId
    const trimmedDraft = messageDraft.trim()

    if (status !== 'connected' || !nextChatId || !trimmedDraft) {
      if (activeTypingChatIdRef.current) {
        stopLocalTyping(activeTypingChatIdRef.current)
      } else {
        clearTypingRefreshTimer()
      }

      return
    }

    if (activeTypingChatIdRef.current && activeTypingChatIdRef.current !== nextChatId) {
      stopLocalTyping(activeTypingChatIdRef.current)
    }

    if (activeTypingChatIdRef.current !== nextChatId) {
      const didStart = startLocalTyping(nextChatId)

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

      void sendTypingCommand(
        {
          type: 'TYPING_START',
          chatId,
        },
        { log: false },
      )
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

  const handleConnect = () => {
    const currentUserId = userId.trim()

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      setEventLog((current) => appendLog(current, 'Already connected.'))
      return
    }

    if (!serverUrl.trim() || !currentUserId) {
      setEventLog((current) =>
        appendLog(current, 'Server URL and user ID are required.'),
      )
      return
    }

    const url = buildWebSocketUrl(serverUrl, currentUserId)
    const socket = new WebSocket(url)
    socketRef.current = socket

    setStatus('connecting')
    setEventLog((current) => appendLog(current, `Connecting to ${url}`))

    socket.onopen = () => {
      setStatus('connected')
      setIsBootstrapping(true)
      setReadMarkers(loadReadMarkers(currentUserId))
      setEventLog((current) => appendLog(current, `WebSocket connected as ${currentUserId}.`))

      Promise.all([refreshChats(currentUserId), refreshUsers(currentUserId)]).catch(
        (error: Error) => {
          setEventLog((current) =>
            appendLog(current, `Cannot load initial data: ${error.message}`),
          )
        },
      ).finally(() => {
        setIsBootstrapping(false)
      })
    }

    socket.onmessage = (event) => {
      const raw = String(event.data)
      setEventLog((current) => appendLog(current, `Received: ${raw}`))

      if (raw.startsWith('CONNECTED:')) {
        return
      }

      if (raw.startsWith('ERROR:')) {
        appendSystemMessage(selectedChatId, raw)
        return
      }

      let payload: unknown

      try {
        payload = JSON.parse(raw) as WebSocketIncomingEvent
      } catch {
        setEventLog((current) => appendLog(current, `Ignored non-JSON message: ${raw}`))
        return
      }

      if (isPresenceEvent(payload)) {
        setUsers((current) => ({
          ...current,
          [payload.username]: {
            username: payload.username,
            lastPingTime: payload.lastPingTime,
            lastPingReceivedAt: Date.now(),
          },
        }))
        return
      }

      if (isTypingEvent(payload)) {
        if (payload.username && payload.username === userIdRef.current) {
          return
        }

        if (payload.type === 'typing:stop' || payload.type === 'TYPING_END') {
          setRemoteTypingByChatId((current) => {
            if (!current[payload.chatId]) {
              return current
            }

            const next = { ...current }
            delete next[payload.chatId]
            return next
          })
          return
        }

        const chat = chatsRef.current.find((entry) => entry.chatId === payload.chatId)
        const typingUser =
          payload.username && payload.username !== userIdRef.current
            ? payload.username
            : chat?.username ?? 'Someone'

        setRemoteTypingByChatId((current) => ({
          ...current,
          [payload.chatId]: typingUser,
        }))
        return
      }

      if (hasTypedEventShape(payload)) {
        if (
          payload.type === 'MESSAGE' &&
          isMessageRecord(payload)
        ) {
          const payloadMessage = payload
          const message: ChatMessage = {
            ...toChatMessage(payloadMessage, userIdRef.current),
            id: toMessageId(payloadMessage),
          }

          if (message.senderUserId !== userIdRef.current) {
            setRemoteTypingByChatId((current) => {
              if (!current[message.chatId]) {
                return current
              }

              const next = { ...current }
              delete next[message.chatId]
              return next
            })
          }

          const chat = chatsRef.current.find((entry) => entry.chatId === message.chatId)
          upsertMessages(message.chatId, chat?.username ?? message.senderUserId, [message])
          syncChatPreview(message.chatId, message.text)
          syncChatTimestamp(message.chatId, message.timestamp)

          setChats((current) => {
            if (!current.some((entry) => entry.chatId === message.chatId)) {
              void refreshChats(userIdRef.current)
              return current
            }

            if (selectedChatIdRef.current === message.chatId) {
              markChatAsRead(message.chatId, message.timestamp)
            }

            return current.map((entry) =>
              entry.chatId === message.chatId
                ? {
                    ...entry,
                    preview: message.text,
                    unreadCount:
                      selectedChatIdRef.current === message.chatId ||
                      message.senderUserId === userIdRef.current
                        ? 0
                        : (entry.unreadCount ?? 0) + 1,
                  }
                : entry,
            )
          })
          return
        }

        setEventLog((current) =>
          appendLog(
            current,
            `Ignored unsupported websocket event type: ${String(payload.type)}`,
          ),
        )
        return
      }

      if (!isMessageRecord(payload)) {
        setEventLog((current) =>
          appendLog(current, 'Ignored websocket payload with unsupported structure.'),
        )
        return
      }

      const payloadMessage = payload
      const message: ChatMessage = {
        ...toChatMessage(payloadMessage, userIdRef.current),
        id: toMessageId(payloadMessage),
      }

      if (message.senderUserId !== userIdRef.current) {
        setRemoteTypingByChatId((current) => {
          if (!current[message.chatId]) {
            return current
          }

          const next = { ...current }
          delete next[message.chatId]
          return next
        })
      }

      const chat = chatsRef.current.find((entry) => entry.chatId === message.chatId)
      upsertMessages(message.chatId, chat?.username ?? message.senderUserId, [message])
      syncChatPreview(message.chatId, message.text)
      syncChatTimestamp(message.chatId, message.timestamp)

      setChats((current) => {
        if (!current.some((entry) => entry.chatId === message.chatId)) {
          void refreshChats(userIdRef.current)
          return current
        }

        if (selectedChatIdRef.current === message.chatId) {
          markChatAsRead(message.chatId, message.timestamp)
        }

        return current.map((entry) =>
          entry.chatId === message.chatId
            ? {
                ...entry,
                preview: message.text,
                unreadCount:
                  selectedChatIdRef.current === message.chatId ||
                  message.senderUserId === userIdRef.current
                    ? 0
                    : (entry.unreadCount ?? 0) + 1,
              }
            : entry,
        )
      })
    }

    socket.onerror = () => {
      setEventLog((current) => appendLog(current, 'WebSocket error.'))
      appendSystemMessage(selectedChatId, 'WebSocket error.')
    }

    socket.onclose = () => {
      setStatus('disconnected')
      setIsBootstrapping(false)
      setIsHistoryLoading(false)
      setEventLog((current) => appendLog(current, 'WebSocket closed.'))
      setChats([])
      setRemoteTypingByChatId({})
      setUsers({})
      setThreads({})
      setSelectedChatId(null)
      setReadMarkers({})
      clearTypingRefreshTimer()
      activeTypingChatIdRef.current = null
      socketRef.current = null
    }
  }

  const handleDisconnect = () => {
    if (!socketRef.current) {
      setEventLog((current) => appendLog(current, 'No active connection.'))
      return
    }

    stopLocalTyping(activeTypingChatIdRef.current)
    socketRef.current.close()
  }

  const handleCreateChat = async () => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      setEventLog((current) => appendLog(current, 'Connect first.'))
      return
    }

    const currentUserId = userId.trim()
    const username = newChatUserId.trim().toLowerCase()

    if (!username) {
      setEventLog((current) => appendLog(current, 'Cannot create chat without a username.'))
      return
    }

    try {
      const chat = await createChat(serverUrl, currentUserId, username)
      setNewChatUserId('')
      setEventLog((current) => appendLog(current, `Chat created: ${chat.chatId}`))
      await Promise.all([refreshChats(currentUserId), refreshUsers(currentUserId)])
      setSelectedChatId(chat.chatId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Create chat failed.'
      setEventLog((current) => appendLog(current, `Create chat failed: ${message}`))
      appendSystemMessage(selectedChatId, `Create chat failed: ${message}`)
    }
  }

  const handleSendMessage = () => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      setEventLog((current) => appendLog(current, 'Connect first.'))
      return
    }

    if (!selectedThread || !messageDraft.trim()) {
      setEventLog((current) => appendLog(current, 'Select a chat and enter a message.'))
      return
    }

    const payload: SendMessageCommand = {
      type: 'MESSAGE',
      chatId: selectedThread.chatId,
      text: messageDraft.trim(),
    }

    sendWebSocketCommand(socketRef.current, payload)
    setEventLog((current) => appendLog(current, `Sent: ${JSON.stringify(payload)}`))
    stopLocalTyping(selectedThread.chatId)
    setMessageDraft('')
  }

  const handleShellPointerMove = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top

    event.currentTarget.style.setProperty('--spotlight-x', `${x}px`)
    event.currentTarget.style.setProperty('--spotlight-y', `${y}px`)
  }

  const handleShellPointerLeave = (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty('--spotlight-x', '50%')
    event.currentTarget.style.setProperty('--spotlight-y', '18%')
  }

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
                serverUrl={serverUrl}
                userId={userId}
                status={status}
                onServerUrlChange={setServerUrl}
                onUserIdChange={setUserId}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
              />
            ) : null}
          </AnimatePresence>

          <ConnectionPanel isCompactMobile={isMobileChatOpen} />

          <motion.section
            className={`workspace-grid ${selectedChatId ? 'has-mobile-chat-open' : 'is-mobile-inbox-open'}`}
            variants={shellStagger}
          >
            {isMobileLayout ? (
              <div className="mobile-workspace">
                <motion.div
                  className="mobile-screen mobile-screen-inbox"
                  initial={false}
                  animate={{
                    x: isMobileChatOpen ? '-100%' : '0%',
                    opacity: 1,
                    scale: 1,
                  }}
                  transition={panelTransition}
                  style={{ pointerEvents: isMobileChatOpen ? 'none' : 'auto' }}
                >
                  <ChatSidebar
                    currentUserId={userId.trim()}
                    chats={chats}
                    selectedChatId={selectedChatId}
                    users={users}
                    status={status}
	                  newChatUserId={newChatUserId}
	                  onNewChatUserIdChange={setNewChatUserId}
	                  onCreateChat={handleCreateChat}
	                  onSelectChat={handleSelectChat}
	                  onDisconnect={handleDisconnect}
	                />
                </motion.div>

                <motion.div
                  className="mobile-screen mobile-screen-chat"
                  initial={false}
                  animate={{
                    x: isMobileChatOpen ? '0%' : '100%',
                    opacity: 1,
                    scale: 1,
                  }}
                  transition={panelTransition}
                  style={{ pointerEvents: isMobileChatOpen ? 'auto' : 'none' }}
                >
                  <motion.div className="workspace-main" variants={shellStagger}>
                    <ConversationPanel
                      thread={selectedThread}
                      user={selectedUser}
                      currentUserId={userId.trim()}
                      isMobileLayout={isMobileLayout}
                      connectionStatus={status}
                      isHistoryLoading={isHistoryLoading || isBootstrapping}
                      isDrafting={isDrafting}
                      remoteTypingLabel={remoteTypingLabel}
                      messageDraft={messageDraft}
                      onMessageDraftChange={setMessageDraft}
                      onBackToInbox={() => setSelectedChatId(null)}
                      onSendMessage={handleSendMessage}
                    />

                    <EventLogPanel lines={eventLog.slice(0, 18)} />
                  </motion.div>
                </motion.div>
              </div>
            ) : (
              <>
                <ChatSidebar
                  currentUserId={userId.trim()}
                  chats={chats}
                  selectedChatId={selectedChatId}
                  users={users}
                  status={status}
	                  newChatUserId={newChatUserId}
	                  onNewChatUserIdChange={setNewChatUserId}
	                  onCreateChat={handleCreateChat}
	                  onSelectChat={handleSelectChat}
	                  onDisconnect={handleDisconnect}
	                />

                <motion.div className="workspace-main" variants={shellStagger}>
                  <ConversationPanel
                    thread={selectedThread}
                    user={selectedUser}
                    currentUserId={userId.trim()}
                    isMobileLayout={isMobileLayout}
                    connectionStatus={status}
                    isHistoryLoading={isHistoryLoading || isBootstrapping}
                    isDrafting={isDrafting}
                    remoteTypingLabel={remoteTypingLabel}
                    messageDraft={messageDraft}
                    onMessageDraftChange={setMessageDraft}
                    onBackToInbox={() => setSelectedChatId(null)}
                    onSendMessage={handleSendMessage}
                  />

                  <EventLogPanel lines={eventLog.slice(0, 18)} />
                </motion.div>
              </>
            )}
          </motion.section>
        </motion.main>
      </motion.div>
    </MotionConfig>
  )
}
