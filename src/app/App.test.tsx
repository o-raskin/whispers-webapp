import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { PRESENCE_PING_INTERVAL_MS } from '../shared/config/backend'

const apiMocks = vi.hoisted(() => ({
  mockBuildWebSocketUrl: vi.fn(
    (serverUrl: string, userId: string) => `${serverUrl}?userId=${userId}`,
  ),
  mockCreateChat: vi.fn(),
  mockFetchChats: vi.fn(),
  mockFetchMessages: vi.fn(),
  mockFetchUsers: vi.fn(),
  mockSendWebSocketCommand: vi.fn(
    (socket: { send: (payload: string) => void }, payload: unknown) => {
      socket.send(JSON.stringify(payload))
    },
  ),
}))

vi.mock('../shared/api/chatApi', () => ({
  buildWebSocketUrl: apiMocks.mockBuildWebSocketUrl,
  createChat: apiMocks.mockCreateChat,
  fetchChats: apiMocks.mockFetchChats,
  fetchMessages: apiMocks.mockFetchMessages,
  fetchUsers: apiMocks.mockFetchUsers,
  sendWebSocketCommand: apiMocks.mockSendWebSocketCommand,
}))

vi.mock('../features/connection/components/ConnectionPanel', () => ({
  ConnectionPanel: () => <div data-testid="connection-panel">connection panel</div>,
}))

vi.mock('../features/welcome/components/WelcomeExperience', () => ({
  WelcomeExperience: ({
    serverUrl,
    userId,
    status,
    onServerUrlChange,
    onUserIdChange,
    onConnect,
    onDisconnect,
  }: {
    serverUrl: string
    userId: string
    status: string
    onServerUrlChange: (value: string) => void
    onUserIdChange: (value: string) => void
    onConnect: () => void
    onDisconnect: () => void
  }) => (
    <div data-testid="welcome">
      <div data-testid="welcome-status">{status}</div>
      <input
        aria-label="welcome server url"
        value={serverUrl}
        onChange={(event) => onServerUrlChange(event.target.value)}
      />
      <input
        aria-label="welcome user id"
        value={userId}
        onChange={(event) => onUserIdChange(event.target.value)}
      />
      <button type="button" onClick={onConnect}>
        connect
      </button>
      <button type="button" onClick={onDisconnect}>
        disconnect
      </button>
    </div>
  ),
}))

vi.mock('../features/chat-list/components/ChatSidebar', () => ({
  ChatSidebar: ({
    chats,
    users,
    selectedChatId,
    newChatUserId,
    onNewChatUserIdChange,
    onCreateChat,
    onSelectChat,
  }: {
    chats: Array<{ chatId: string; username: string; unreadCount?: number }>
    users: Record<string, { username: string }>
    selectedChatId: string | null
    newChatUserId: string
    onNewChatUserIdChange: (value: string) => void
    onCreateChat: () => void
    onSelectChat: (chatId: string) => void
  }) => (
    <div data-testid="sidebar">
      <div data-testid="selected-chat">{selectedChatId ?? 'none'}</div>
      <div data-testid="known-users">{Object.keys(users).join(',')}</div>
      <input
        aria-label="new chat user"
        value={newChatUserId}
        onChange={(event) => onNewChatUserIdChange(event.target.value)}
      />
      <button type="button" onClick={onCreateChat}>
        create chat
      </button>
      {chats.map((chat) => (
        <button
          key={chat.chatId}
          type="button"
          onClick={() => onSelectChat(chat.chatId)}
        >
          {`chat:${chat.username}:${chat.unreadCount ?? 0}`}
        </button>
      ))}
    </div>
  ),
}))

vi.mock('../features/conversation/components/ConversationPanel', () => ({
  ConversationPanel: ({
    thread,
    remoteTypingLabel,
    messageDraft,
    connectionStatus,
    onMessageDraftChange,
    onBackToInbox,
    onSendMessage,
  }: {
    thread: { participant: string; messages: Array<{ text: string }> } | null
    remoteTypingLabel: string | null
    messageDraft: string
    connectionStatus: string
    onMessageDraftChange: (value: string) => void
    onBackToInbox: () => void
    onSendMessage: () => void
  }) => (
    <div data-testid="conversation">
      <div data-testid="participant">{thread?.participant ?? 'none'}</div>
      <div data-testid="message-count">{thread?.messages.length ?? 0}</div>
      <div data-testid="last-message">
        {thread?.messages.at(-1)?.text ?? 'no-messages'}
      </div>
      <div data-testid="typing">{remoteTypingLabel ?? 'none'}</div>
      <div data-testid="connection-status">{connectionStatus}</div>
      <input
        aria-label="draft"
        value={messageDraft}
        onChange={(event) => onMessageDraftChange(event.target.value)}
      />
      <button type="button" onClick={onSendMessage}>
        send message
      </button>
      <button type="button" onClick={onBackToInbox}>
        back to inbox
      </button>
    </div>
  ),
}))

vi.mock('../features/event-log/components/EventLogPanel', () => ({
  EventLogPanel: ({ lines }: { lines: string[] }) => (
    <div data-testid="event-log">
      {lines.map((line, index) => (
        <div key={`${line}-${index}`}>{line}</div>
      ))}
    </div>
  ),
}))

class MockWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: MockWebSocket[] = []

  readonly url: string
  readyState = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  send = vi.fn()

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  })

  emitOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  emitMessage(data: string) {
    this.onmessage?.({ data })
  }

  emitError() {
    this.onerror?.()
  }
}

describe('App', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    apiMocks.mockBuildWebSocketUrl.mockClear()
    apiMocks.mockCreateChat.mockReset()
    apiMocks.mockFetchChats.mockReset()
    apiMocks.mockFetchMessages.mockReset()
    apiMocks.mockFetchUsers.mockReset()
    apiMocks.mockSendWebSocketCommand.mockClear()
  })

  test('connects, bootstraps chats, loads history, and sends messages', async () => {
    const user = userEvent.setup()
    const setIntervalSpy = vi.spyOn(window, 'setInterval')

    apiMocks.mockFetchChats.mockResolvedValue([{ chatId: 'chat-1', username: 'bob' }])
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'bob', lastPingTime: null }])
    apiMocks.mockFetchMessages.mockResolvedValue([
      {
        chatId: 'chat-1',
        senderUserId: 'bob',
        text: 'Welcome back',
        timestamp: '2026-04-12T10:00:00Z',
      },
    ])

    render(<App />)

    await user.type(screen.getByLabelText('welcome user id'), 'alice')
    await user.click(screen.getByRole('button', { name: 'connect' }))

    const socket = MockWebSocket.instances[0]
    expect(socket.url).toBe('ws://192.168.0.10:8080/ws/user?userId=alice')

    await act(async () => {
      socket.emitOpen()
    })

    await waitFor(() => {
      expect(apiMocks.mockFetchChats).toHaveBeenCalledWith(
        'ws://192.168.0.10:8080/ws/user',
        'alice',
      )
      expect(apiMocks.mockFetchUsers).toHaveBeenCalledWith(
        'ws://192.168.0.10:8080/ws/user',
        'alice',
      )
    })

    await waitFor(() => {
      expect(screen.getByText('chat:bob:1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'chat:bob:1' }))

    await waitFor(() => {
      expect(apiMocks.mockFetchMessages).toHaveBeenCalledWith(
        'ws://192.168.0.10:8080/ws/user',
        'alice',
        'chat-1',
      )
      expect(screen.getByTestId('participant')).toHaveTextContent('bob')
      expect(screen.getByTestId('message-count')).toHaveTextContent('1')
    })

    await user.type(screen.getByLabelText('draft'), 'hello team')
    await user.click(screen.getByRole('button', { name: 'send message' }))

    expect(apiMocks.mockSendWebSocketCommand).toHaveBeenCalledWith(
      expect.objectContaining({ send: expect.any(Function) }),
      expect.objectContaining({
        type: 'MESSAGE',
        chatId: 'chat-1',
        text: 'hello team',
      }),
    )

    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      PRESENCE_PING_INTERVAL_MS,
    )
    expect(apiMocks.mockSendWebSocketCommand).toHaveBeenCalledWith(
      expect.objectContaining({ send: expect.any(Function) }),
      { type: 'PRESENCE' },
    )

    await waitFor(() => {
      expect(localStorage.getItem('whispers-read-markers:alice')).toContain('chat-1')
    })
  })

  test('reacts to websocket events, creates chats, and disconnects cleanly', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockImplementation(async () => [
      { chatId: 'chat-1', username: 'bob' },
      ...(apiMocks.mockCreateChat.mock.calls.length > 0
        ? [{ chatId: 'chat-2', username: 'carol' }]
        : []),
    ])
    apiMocks.mockFetchUsers.mockResolvedValue([
      { username: 'bob', lastPingTime: null },
      { username: 'carol', lastPingTime: null },
    ])
    apiMocks.mockFetchMessages.mockImplementation(
      async (_serverUrl, _userId, chatId: string) => {
      if (chatId === 'chat-2') {
        return []
      }

      return [
        {
          chatId: 'chat-1',
          senderUserId: 'bob',
          text: 'Initial hello',
          timestamp: '2026-04-12T10:00:00Z',
        },
      ]
      },
    )
    apiMocks.mockCreateChat.mockResolvedValue({ chatId: 'chat-2', username: 'carol' })

    render(<App />)

    await user.type(screen.getByLabelText('welcome user id'), 'alice')
    await user.click(screen.getByRole('button', { name: 'connect' }))

    const socket = MockWebSocket.instances[0]
    await act(async () => {
      socket.emitOpen()
    })

    await waitFor(() => {
      expect(screen.getByText('chat:bob:1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'chat:bob:1' }))

    await waitFor(() => {
      expect(screen.getByTestId('participant')).toHaveTextContent('bob')
    })

    await act(async () => {
      socket.emitMessage(
        JSON.stringify({
          type: 'presence',
          username: 'bob',
          lastPingTime: '2026-04-12T10:05:00Z',
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('known-users')).toHaveTextContent('bob')
    })

    await act(async () => {
      socket.emitMessage(
        JSON.stringify({
          type: 'typing:start',
          chatId: 'chat-1',
          username: 'bob',
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('typing')).toHaveTextContent('bob')
    })

    await act(async () => {
      socket.emitMessage(
        JSON.stringify({
          type: 'MESSAGE',
          chatId: 'chat-1',
          senderUserId: 'bob',
          text: 'Fresh update',
          timestamp: '2026-04-12T10:06:00Z',
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('message-count')).toHaveTextContent('2')
      expect(screen.getByTestId('last-message')).toHaveTextContent('Fresh update')
      expect(screen.getByTestId('typing')).toHaveTextContent('none')
      expect(screen.getByText('chat:bob:0')).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('new chat user'), 'carol')
    await user.click(screen.getByRole('button', { name: 'create chat' }))

    await waitFor(() => {
      expect(apiMocks.mockCreateChat).toHaveBeenCalledWith(
        'ws://192.168.0.10:8080/ws/user',
        'alice',
        'carol',
      )
      expect(screen.getByTestId('selected-chat')).toHaveTextContent('chat-2')
    })

    await act(async () => {
      socket.close()
    })

    await waitFor(() => {
      expect(screen.getByTestId('welcome-status')).toHaveTextContent('disconnected')
      expect(screen.getByTestId('selected-chat')).toHaveTextContent('none')
    })
  })

  test('handles invalid connection attempts and socket errors', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.clear(screen.getByLabelText('welcome server url'))
    await user.click(screen.getByRole('button', { name: 'connect' }))

    expect(screen.getByTestId('event-log')).toHaveTextContent(
      'Server URL and user ID are required.',
    )

    await user.type(screen.getByLabelText('welcome server url'), 'ws://192.168.0.10:8080/ws/user')
    await user.type(screen.getByLabelText('welcome user id'), 'alice')
    await user.click(screen.getByRole('button', { name: 'connect' }))

    const socket = MockWebSocket.instances[0]
    await act(async () => {
      socket.emitError()
    })

    expect(screen.getByTestId('event-log')).toHaveTextContent('WebSocket error.')
  })

  test('starts and stops typing notifications as the draft changes', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockResolvedValue([{ chatId: 'chat-1', username: 'bob' }])
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'bob', lastPingTime: null }])
    apiMocks.mockFetchMessages.mockResolvedValue([
      {
        chatId: 'chat-1',
        senderUserId: 'bob',
        text: 'Ready when you are',
        timestamp: '2026-04-12T10:00:00Z',
      },
    ])

    render(<App />)

    await user.type(screen.getByLabelText('welcome user id'), 'alice')
    await user.click(screen.getByRole('button', { name: 'connect' }))

    const socket = MockWebSocket.instances[0]
    await act(async () => {
      socket.emitOpen()
    })

    await waitFor(() => {
      expect(screen.getByText('chat:bob:1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'chat:bob:1' }))

    await waitFor(() => {
      expect(screen.getByTestId('participant')).toHaveTextContent('bob')
    })

    const baselineCalls = apiMocks.mockSendWebSocketCommand.mock.calls.length

    await user.type(screen.getByLabelText('draft'), 'h')

    await waitFor(() => {
      expect(apiMocks.mockSendWebSocketCommand.mock.calls.length).toBeGreaterThan(
        baselineCalls,
      )
      expect(apiMocks.mockSendWebSocketCommand).toHaveBeenCalledWith(
        expect.objectContaining({ send: expect.any(Function) }),
        { type: 'TYPING_START', chatId: 'chat-1' },
      )
    })

    await user.clear(screen.getByLabelText('draft'))

    await waitFor(() => {
      expect(apiMocks.mockSendWebSocketCommand).toHaveBeenCalledWith(
        expect.objectContaining({ send: expect.any(Function) }),
        { type: 'TYPING_END', chatId: 'chat-1' },
      )
    })
  })

  test('updates shell spotlight coordinates from pointer movement', () => {
    render(<App />)

    const shell = document.querySelector('.app-shell')
    expect(shell).not.toBeNull()

    Object.defineProperty(shell!, 'getBoundingClientRect', {
      value: () => ({
        left: 10,
        top: 20,
        right: 210,
        bottom: 220,
        width: 200,
        height: 200,
        x: 10,
        y: 20,
        toJSON: () => ({}),
      }),
    })

    fireEvent.pointerMove(shell!, { clientX: 60, clientY: 80 })
    expect(shell).toHaveStyle({
      '--spotlight-x': '50px',
      '--spotlight-y': '60px',
    })

    fireEvent.pointerLeave(shell!)
    expect(shell).toHaveStyle({
      '--spotlight-x': '50%',
      '--spotlight-y': '18%',
    })
  })

  test('syncs the app height to the visible viewport on mobile browsers', async () => {
    render(<App />)

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--app-visible-height')).toBe(
        '844px',
      )
      expect(document.documentElement.style.getPropertyValue('--app-visible-offset-top')).toBe(
        '0px',
      )
    })
  })
})
