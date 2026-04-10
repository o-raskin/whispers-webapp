import { useEffect, useRef, useState } from 'react'
import { ChatSidebar } from '../features/chat-list/components/ChatSidebar'
import { ConnectionPanel } from '../features/connection/components/ConnectionPanel'
import { ConversationPanel } from '../features/conversation/components/ConversationPanel'
import { EventLogPanel } from '../features/event-log/components/EventLogPanel'
import {
  buildWebSocketUrl,
  createChat,
  fetchChats,
  fetchMessages,
  fetchUsers,
  sendPresencePing,
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
  MessageRecord,
  PresenceEvent,
  SendMessageCommand,
  UserPresence,
} from '../shared/types/chat'
import { isUserOnline } from '../shared/utils/presence'

function appendLog(lines: string[], message: string) {
  const timestamp = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return [`[${timestamp}] ${message}`, ...lines]
}

function isPresenceEvent(payload: PresenceEvent | MessageRecord): payload is PresenceEvent {
  return 'type' in payload && payload.type === 'presence'
}

export function App() {
  const socketRef = useRef<WebSocket | null>(null)
  const pingTimerRef = useRef<number | null>(null)
  const userIdRef = useRef('')
  const chatsRef = useRef<ChatSummary[]>([])
  const selectedChatIdRef = useRef<string | null>(null)

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
  const [eventLog, setEventLog] = useState<string[]>([
    '[09:00:12] Client initialized from swagger contract.',
  ])

  const selectedThread = selectedChatId ? threads[selectedChatId] ?? null : null
  const selectedUser = selectedThread ? users[selectedThread.participant] ?? null : null
  const onlineCount = Object.values(users).filter((user) => isUserOnline(user)).length
  const unreadCount = chats.reduce((total, chat) => total + (chat.unreadCount ?? 0), 0)

  userIdRef.current = userId.trim()
  chatsRef.current = chats
  selectedChatIdRef.current = selectedChatId

  const appendSystemMessage = (chatId: string | null, text: string) => {
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
  }

  const upsertMessages = (
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
  }

  const syncChatPreview = (chatId: string, preview: string) => {
    setChats((current) =>
      current.map((chat) => (chat.chatId === chatId ? { ...chat, preview } : chat)),
    )
  }

  const refreshUsers = async (currentUserId: string) => {
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
  }

  const refreshChats = async (currentUserId: string) => {
    const payload = await fetchChats(serverUrl, currentUserId)

    setChats((current) =>
      payload.map((chat) => {
        const existing = current.find((item) => item.chatId === chat.chatId)
        return {
          ...chat,
          preview: existing?.preview,
          unreadCount: existing?.unreadCount ?? 0,
        }
      }),
    )

    setSelectedChatId((current) => {
      if (current && payload.some((chat) => chat.chatId === current)) {
        return current
      }

      return payload[0]?.chatId ?? null
    })
  }

  const loadHistory = async (chatId: string, currentUserId: string) => {
    const chat = chats.find((entry) => entry.chatId === chatId)
    if (!chat) {
      return
    }

    const payload = await fetchMessages(serverUrl, currentUserId, chatId)
    const normalized = payload.map((message) => ({
      ...message,
      direction:
        message.senderUserId === currentUserId
          ? ('sent' as const)
          : ('received' as const),
    }))

    upsertMessages(chatId, chat.username, normalized)
    syncChatPreview(chatId, normalized.at(-1)?.text ?? '')
  }

  useEffect(() => {
    return () => {
      if (pingTimerRef.current !== null) {
        window.clearInterval(pingTimerRef.current)
      }

      socketRef.current?.close()
    }
  }, [])

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
  }, [selectedChatId, serverUrl, userId])

  useEffect(() => {
    if (!selectedChatId) {
      return
    }

    setChats((current) =>
      current.map((chat) =>
        chat.chatId === selectedChatId ? { ...chat, unreadCount: 0 } : chat,
      ),
    )
  }, [selectedChatId])

  useEffect(() => {
    if (status !== 'connected' || !userId.trim()) {
      if (pingTimerRef.current !== null) {
        window.clearInterval(pingTimerRef.current)
        pingTimerRef.current = null
      }

      return
    }

    const runPing = () => {
      sendPresencePing(serverUrl, userId.trim()).catch((error: Error) => {
        setEventLog((current) => appendLog(current, `Ping failed: ${error.message}`))
      })
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

      let payload: PresenceEvent | MessageRecord

      try {
        payload = JSON.parse(raw) as PresenceEvent | MessageRecord
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

      const payloadMessage = payload
      const message: ChatMessage = {
        id: `${payloadMessage.chatId}-${payloadMessage.senderUserId}-${payloadMessage.timestamp}-${payloadMessage.text}`,
        chatId: payloadMessage.chatId,
        senderUserId: payloadMessage.senderUserId,
        text: payloadMessage.text,
        timestamp: payloadMessage.timestamp,
        direction:
          payloadMessage.senderUserId === userIdRef.current
            ? ('sent' as const)
            : ('received' as const),
      }

      const chat = chatsRef.current.find((entry) => entry.chatId === message.chatId)
      upsertMessages(message.chatId, chat?.username ?? message.senderUserId, [message])
      syncChatPreview(message.chatId, message.text)

      setChats((current) => {
        if (!current.some((entry) => entry.chatId === message.chatId)) {
          void refreshChats(userIdRef.current)
          return current
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
      setUsers({})
      setThreads({})
      setSelectedChatId(null)
      socketRef.current = null
    }
  }

  const handleDisconnect = () => {
    if (!socketRef.current) {
      setEventLog((current) => appendLog(current, 'No active connection.'))
      return
    }

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
      chatId: selectedThread.chatId,
      text: messageDraft.trim(),
    }

    socketRef.current.send(JSON.stringify(payload))
    setEventLog((current) => appendLog(current, `Sent: ${JSON.stringify(payload)}`))
    setMessageDraft('')
  }

  return (
    <div className="app-frame">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <div className="ambient ambient-three" aria-hidden="true" />

      <main className="app-shell">
        <ConnectionPanel
          serverUrl={serverUrl}
          userId={userId}
          status={status}
          chatCount={chats.length}
          onlineCount={onlineCount}
          unreadCount={unreadCount}
          onServerUrlChange={setServerUrl}
          onUserIdChange={setUserId}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />

        <section className="chat-layout">
          <ChatSidebar
            chats={chats}
            selectedChatId={selectedChatId}
            users={users}
            status={status}
            newChatUserId={newChatUserId}
            onNewChatUserIdChange={setNewChatUserId}
            onCreateChat={handleCreateChat}
            onSelectChat={setSelectedChatId}
          />

          <ConversationPanel
            thread={selectedThread}
            user={selectedUser}
            currentUserId={userId.trim()}
            connectionStatus={status}
            isHistoryLoading={isHistoryLoading || isBootstrapping}
            messageDraft={messageDraft}
            onMessageDraftChange={setMessageDraft}
            onSendMessage={handleSendMessage}
          />
        </section>

        <EventLogPanel lines={eventLog.slice(0, 18)} />
      </main>
    </div>
  )
}
