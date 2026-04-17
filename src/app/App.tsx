import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
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
import { DEFAULT_WS_URL, PRESENCE_PING_INTERVAL_MS } from '../shared/config/backend'
import { shellStagger } from '../shared/motion/presets'
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
import {
  isCallSignalText,
  parseCallSignalText,
} from '../shared/utils/callSignals'
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
import {
  countUnreadMessages,
  loadReadMarkers,
  saveReadMarkers,
} from './utils/readMarkers'
import {
  hasTypedEventShape,
  isMessageRecord,
  isPresenceEvent,
  isTypingEvent,
} from './utils/websocketPayloadGuards'

const TYPING_REFRESH_INTERVAL_MS = 4000

export function App() {
  const socketRef = useRef<WebSocket | null>(null)
  const pingTimerRef = useRef<number | null>(null)
  const typingTimerRef = useRef<number | null>(null)
  const activeTypingChatIdRef = useRef<string | null>(null)
  const userIdRef = useRef('')
  const chatsRef = useRef<ChatSummary[]>([])
  const selectedChatIdRef = useRef<string | null>(null)
  const threadsRef = useRef<Record<string, ChatThread>>({})
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
  const [remoteTypingByChatId, setRemoteTypingByChatId] = useState<Record<string, string>>({})
  const [readMarkers, setReadMarkers] = useState<Record<string, string>>({})
  const [eventLog, setEventLog] = useState<string[]>([
    '[09:00:12] Client initialized from swagger contract.',
  ])

  const { handleShellPointerLeave, handleShellPointerMove, isMobileLayout } =
    useResponsiveAppShell()

  const currentUserId = userId.trim()
  const selectedThread = selectedChatId ? threads[selectedChatId] ?? null : null
  const selectedChatSummary = selectedChatId
    ? chats.find((chat) => chat.chatId === selectedChatId) ?? null
    : null
  const selectedUser = selectedThread ? users[selectedThread.participant] ?? null : null
  const remoteTypingLabel = selectedChatId ? remoteTypingByChatId[selectedChatId] ?? null : null
  const showWelcome = status !== 'connected'
  const isDrafting = Boolean(messageDraft.trim())
  const isMobileChatOpen = isMobileLayout && Boolean(selectedChatId)

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

  const startLocalTyping = useCallback((
    chatId: string,
    options?: { log?: boolean },
  ) => {
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

  const markChatAsRead = useCallback((
    chatId: string,
    timestamp: string | null | undefined,
  ) => {
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

  const hydrateChatSummaries = useCallback(async (
    nextUserId: string,
    chatSummaries: ChatSummary[],
  ) => {
    if (chatSummaries.length === 0) {
      return
    }

    const historyResults = await Promise.allSettled(
      chatSummaries.map(async (chat) => {
        const messages = filterVisibleMessages(
          await fetchMessages(serverUrl, nextUserId, chat.chatId),
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

  const refreshUsers = useCallback(async (nextUserId: string) => {
    const payload = await fetchUsers(serverUrl, nextUserId)

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

  const refreshChats = useCallback(async (nextUserId: string) => {
    const payload = await fetchChats(serverUrl, nextUserId)

    setChats((current) => mergeFetchedChats(current, payload))

    setSelectedChatId((current) => {
      if (current && payload.some((chat) => chat.chatId === current)) {
        return current
      }

      return null
    })

    await hydrateChatSummaries(nextUserId, payload)
  }, [hydrateChatSummaries, serverUrl])

  const loadHistory = useCallback(async (chatId: string, nextUserId: string) => {
    const chat = chatsRef.current.find((entry) => entry.chatId === chatId)

    if (!chat) {
      return
    }

    const payload = filterVisibleMessages(await fetchMessages(serverUrl, nextUserId, chatId))
    const normalizedMessages = payload.map((message) => toChatMessage(message, nextUserId))
    const latestMessage = normalizedMessages.at(-1)

    upsertMessages(chatId, chat.username, normalizedMessages)
    syncChatPreview(chatId, latestMessage?.text ?? '')

    if (latestMessage) {
      syncChatTimestamp(chatId, latestMessage.timestamp)
      markChatAsRead(chatId, latestMessage.timestamp)
    }
  }, [markChatAsRead, serverUrl, syncChatPreview, syncChatTimestamp, upsertMessages])

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

  const handleSelectChat = useCallback((chatId: string) => {
    if (activeCallState && activeCallState.chatId !== chatId) {
      endActiveCall({ notifyRemote: true })
    }

    setSelectedChatId(chatId)
    setIsHistoryLoading(true)
  }, [activeCallState, endActiveCall])

  const handleIncomingChatMessage = useCallback((payloadMessage: MessageRecord) => {
    const message: ChatMessage = {
      ...toChatMessage(payloadMessage, userIdRef.current),
      id: toMessageId(payloadMessage),
    }

    if (message.senderUserId !== userIdRef.current) {
      clearRemoteTyping(message.chatId)
    }

    const chat = chatsRef.current.find((entry) => entry.chatId === message.chatId)
    upsertMessages(message.chatId, chat?.username ?? message.senderUserId, [message])

    setChats((current) => {
      if (!current.some((entry) => entry.chatId === message.chatId)) {
        void refreshChats(userIdRef.current)
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
  }, [clearRemoteTyping, markChatAsRead, refreshChats, upsertMessages])

  const handleSocketMessage = useCallback((raw: string) => {
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
      if (isCallSignalText(payload.text)) {
        const signal = parseCallSignalText(payload.text)

        if (!signal) {
          appendEventLog('Ignored malformed hidden call signal message.')
          return
        }

        void handleCallSignalMessage(payload, signal)
        return
      }

      handleIncomingChatMessage(payload)
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
      if (payload.username && payload.username === userIdRef.current) {
        return
      }

      if (payload.type === 'typing:stop' || payload.type === 'TYPING_END') {
        clearRemoteTyping(payload.chatId)
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
      appendEventLog(
        `Ignored unsupported websocket event type: ${String(payload.type)}`,
      )
      return
    }

    appendEventLog('Ignored websocket payload with unsupported structure.')
  }, [
    appendEventLog,
    appendSystemMessage,
    clearRemoteTyping,
    handleCallSignalMessage,
    handleIncomingChatMessage,
  ])

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
      .catch((error: Error) => {
        appendEventLog(`Cannot load history: ${error.message}`)
        appendSystemMessage(selectedChatId, `Cannot load history: ${error.message}`)
      })
      .finally(() => {
        setIsHistoryLoading(false)
      })
  }, [appendEventLog, appendSystemMessage, currentUserId, loadHistory, selectedChatId])

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

  const handleConnect = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      appendEventLog('Already connected.')
      return
    }

    if (!serverUrl.trim() || !currentUserId) {
      appendEventLog('Server URL and user ID are required.')
      return
    }

    const url = buildWebSocketUrl(serverUrl, currentUserId)
    const socket = new WebSocket(url)
    socketRef.current = socket

    setStatus('connecting')
    appendEventLog(`Connecting to ${url}`)

    socket.onopen = () => {
      setStatus('connected')
      setIsBootstrapping(true)
      setReadMarkers(loadReadMarkers(currentUserId))
      appendEventLog(`WebSocket connected as ${currentUserId}.`)

      Promise.all([refreshChats(currentUserId), refreshUsers(currentUserId)])
        .catch((error: Error) => {
          appendEventLog(`Cannot load initial data: ${error.message}`)
        })
        .finally(() => {
          setIsBootstrapping(false)
        })
    }

    socket.onmessage = (event) => {
      handleSocketMessage(String(event.data))
    }

    socket.onerror = () => {
      appendEventLog('WebSocket error.')
      appendSystemMessage(selectedChatIdRef.current, 'WebSocket error.')
    }

    socket.onclose = () => {
      setStatus('disconnected')
      setIsBootstrapping(false)
      setIsHistoryLoading(false)
      appendEventLog('WebSocket closed.')
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
  }

  const handleDisconnect = () => {
    if (!socketRef.current) {
      appendEventLog('No active connection.')
      return
    }

    endActiveCall({ notifyRemote: true })
    stopLocalTyping(activeTypingChatIdRef.current)
    socketRef.current.close()
  }

  const handleCreateChat = async () => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      appendEventLog('Connect first.')
      return
    }

    const username = newChatUserId.trim().toLowerCase()

    if (!username) {
      appendEventLog('Cannot create chat without a username.')
      return
    }

    try {
      const chat = await createChat(serverUrl, currentUserId, username)
      setNewChatUserId('')
      appendEventLog(`Chat created: ${chat.chatId}`)
      await Promise.all([refreshChats(currentUserId), refreshUsers(currentUserId)])
      setSelectedChatId(chat.chatId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Create chat failed.'
      appendEventLog(`Create chat failed: ${message}`)
      appendSystemMessage(selectedChatIdRef.current, `Create chat failed: ${message}`)
    }
  }

  const handleSendMessage = () => {
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
  }

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

          <AppWorkspace
            isMobileLayout={isMobileLayout}
            isMobileChatOpen={isMobileChatOpen}
            selectedChatId={selectedChatId}
            eventLogLines={eventLog.slice(0, 18)}
            sidebarProps={{
              chats,
              currentUserId,
              newChatUserId,
              onCreateChat: handleCreateChat,
              onDisconnect: handleDisconnect,
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
