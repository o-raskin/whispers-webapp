import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { DEFAULT_WS_URL, PRESENCE_PING_INTERVAL_MS } from '../shared/config/backend'
import { buildCallSignalText, parseCallSignalText } from '../shared/utils/callSignals'

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
    callPhase,
    connectionStatus,
    localCallStream,
    thread,
    onAcceptCall,
    remoteTypingLabel,
    onDeclineCall,
    onEndCall,
    messageDraft,
    onMessageDraftChange,
    onBackToInbox,
    onSendMessage,
    onStartCall,
    remoteCallStream,
  }: {
    callPhase: string
    connectionStatus: string
    localCallStream: MediaStream | null
    thread: { participant: string; messages: Array<{ text: string }> } | null
    remoteTypingLabel: string | null
    onAcceptCall: () => void
    onDeclineCall: () => void
    onEndCall: () => void
    messageDraft: string
    onMessageDraftChange: (value: string) => void
    onBackToInbox: () => void
    onSendMessage: () => void
    onStartCall: () => void
    remoteCallStream: MediaStream | null
  }) => (
    <div data-testid="conversation">
      <div data-testid="participant">{thread?.participant ?? 'none'}</div>
      <div data-testid="message-count">{thread?.messages.length ?? 0}</div>
      <div data-testid="last-message">
        {thread?.messages.at(-1)?.text ?? 'no-messages'}
      </div>
      <div data-testid="typing">{remoteTypingLabel ?? 'none'}</div>
      <div data-testid="call-phase">{callPhase}</div>
      <div data-testid="local-stream">{localCallStream ? 'yes' : 'no'}</div>
      <div data-testid="remote-stream">{remoteCallStream ? 'yes' : 'no'}</div>
      <div data-testid="connection-status">{connectionStatus}</div>
      <input
        aria-label="draft"
        value={messageDraft}
        onChange={(event) => onMessageDraftChange(event.target.value)}
      />
      <button type="button" onClick={onStartCall}>
        start audio call
      </button>
      <button type="button" onClick={onAcceptCall}>
        accept audio call
      </button>
      <button type="button" onClick={() => onDeclineCall()}>
        decline audio call
      </button>
      <button type="button" onClick={onEndCall}>
        end audio call
      </button>
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

class MockMediaStreamTrack {
  readonly id: string

  constructor(id: string) {
    this.id = id
  }

  stop() {}
}

class MockMediaStream {
  private readonly tracks: MockMediaStreamTrack[]

  constructor(tracks: MockMediaStreamTrack[] = [new MockMediaStreamTrack('track-1')]) {
    this.tracks = tracks
  }

  getTracks() {
    return this.tracks
  }

  addTrack(track: MockMediaStreamTrack) {
    this.tracks.push(track)
  }
}

class MockRTCPeerConnection {
  static instances: MockRTCPeerConnection[] = []

  connectionState: RTCPeerConnectionState = 'new'
  localDescription: RTCSessionDescriptionInit | null = null
  remoteDescription: RTCSessionDescriptionInit | null = null
  onicecandidate: ((event: { candidate: { toJSON: () => RTCIceCandidateInit } | null }) => void) | null = null
  ontrack: ((event: { streams: MockMediaStream[]; track: MockMediaStreamTrack }) => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  private readonly senders: Array<{ track: MockMediaStreamTrack | null }> = []

  constructor(_config?: RTCConfiguration) {
    void _config
    MockRTCPeerConnection.instances.push(this)
  }

  getSenders() {
    return this.senders
  }

  addTrack(track: MockMediaStreamTrack, _stream: MockMediaStream) {
    void _stream
    this.senders.push({ track })
    return { track }
  }

  async createOffer() {
    return {
      type: 'offer' as const,
      sdp: 'mock-offer-sdp',
    }
  }

  async createAnswer() {
    return {
      type: 'answer' as const,
      sdp: 'mock-answer-sdp',
    }
  }

  async setLocalDescription(description: RTCSessionDescriptionInit) {
    this.localDescription = description
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    this.remoteDescription = description
  }

  async addIceCandidate(_candidate: RTCIceCandidateInit) {
    void _candidate
  }

  close() {
    this.connectionState = 'closed'
  }

  emitConnectionState(state: RTCPeerConnectionState) {
    this.connectionState = state
    this.onconnectionstatechange?.()
  }

  emitTrack(stream = new MockMediaStream()) {
    this.ontrack?.({
      streams: [stream],
      track: stream.getTracks()[0],
    })
  }

  emitIceCandidate(candidate: RTCIceCandidateInit) {
    this.onicecandidate?.({
      candidate: {
        toJSON: () => candidate,
      },
    })
  }
}

function createDeferredPromise<T>() {
  let resolvePromise!: (value: T | PromiseLike<T>) => void
  let rejectPromise!: (reason?: unknown) => void

  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  }
}

describe('App', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    MockRTCPeerConnection.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket)
    vi.stubGlobal(
      'RTCPeerConnection',
      MockRTCPeerConnection as unknown as typeof RTCPeerConnection,
    )
    vi.stubGlobal('MediaStream', MockMediaStream as unknown as typeof MediaStream)
    vi.stubGlobal('crypto', {
      randomUUID: () => 'call-1',
    } as unknown as Crypto)
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => new MockMediaStream()),
      },
    })
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
    expect(socket.url).toBe(`${DEFAULT_WS_URL}?userId=alice`)

    await act(async () => {
      socket.emitOpen()
    })

    await waitFor(() => {
      expect(apiMocks.mockFetchChats).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'alice',
      )
      expect(apiMocks.mockFetchUsers).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'alice',
      )
    })

    await waitFor(() => {
      expect(screen.getByText('chat:bob:1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'chat:bob:1' }))

    await waitFor(() => {
      expect(apiMocks.mockFetchMessages).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
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
        DEFAULT_WS_URL,
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

    await user.type(screen.getByLabelText('welcome server url'), DEFAULT_WS_URL)
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

  test('starts an audio call by sending a hidden offer signal', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockResolvedValue([{ chatId: 'chat-1', username: 'bob' }])
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'bob', lastPingTime: null }])
    apiMocks.mockFetchMessages.mockResolvedValue([
      {
        chatId: 'chat-1',
        senderUserId: 'bob',
        text: 'Ready for a call',
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

    await user.click(screen.getByRole('button', { name: 'start audio call' }))

    await waitFor(() => {
      expect(screen.getByTestId('call-phase')).toHaveTextContent('outgoing')
      expect(screen.getByTestId('local-stream')).toHaveTextContent('yes')
    })

    const offerPayload = apiMocks.mockSendWebSocketCommand.mock.calls
      .map(([, payload]) => payload)
      .find(
        (payload): payload is { type: string; chatId: string; text: string } =>
          typeof payload === 'object' &&
          payload !== null &&
          'type' in payload &&
          payload.type === 'MESSAGE' &&
          'chatId' in payload &&
          typeof payload.chatId === 'string' &&
          'text' in payload &&
          typeof payload.text === 'string' &&
          parseCallSignalText(payload.text)?.kind === 'offer',
      )

    expect(offerPayload).toEqual(
      expect.objectContaining({
        type: 'MESSAGE',
        chatId: 'chat-1',
      }),
    )
    expect(parseCallSignalText(String(offerPayload?.text))).toEqual(
      expect.objectContaining({
        version: 1,
        kind: 'offer',
        chatId: 'chat-1',
        callId: 'call-1',
        sdp: 'mock-offer-sdp',
      }),
    )
  })

  test('creates only one peer connection when call start is triggered twice during media setup', async () => {
    const user = userEvent.setup()
    const deferredStream = createDeferredPromise<MockMediaStream>()
    const getUserMediaMock = vi.fn(() => deferredStream.promise)

    vi.stubGlobal('crypto', {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('call-1')
        .mockReturnValueOnce('call-2'),
    } as unknown as Crypto)
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: getUserMediaMock,
      },
    })

    apiMocks.mockFetchChats.mockResolvedValue([{ chatId: 'chat-1', username: 'bob' }])
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'bob', lastPingTime: null }])
    apiMocks.mockFetchMessages.mockResolvedValue([
      {
        chatId: 'chat-1',
        senderUserId: 'bob',
        text: 'Ready for a call',
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

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'start audio call' }))
      fireEvent.click(screen.getByRole('button', { name: 'start audio call' }))
    })

    expect(getUserMediaMock).toHaveBeenCalledTimes(1)
    expect(MockRTCPeerConnection.instances).toHaveLength(0)

    await act(async () => {
      deferredStream.resolve(new MockMediaStream())
      await deferredStream.promise
    })

    await waitFor(() => {
      expect(MockRTCPeerConnection.instances).toHaveLength(1)
      expect(screen.getByTestId('call-phase')).toHaveTextContent('outgoing')
    })

    const offerSignals = apiMocks.mockSendWebSocketCommand.mock.calls
      .map(([, payload]) => payload)
      .filter(
        (payload): payload is { type: string; chatId: string; text: string } =>
          typeof payload === 'object' &&
          payload !== null &&
          'type' in payload &&
          payload.type === 'MESSAGE' &&
          'chatId' in payload &&
          typeof payload.chatId === 'string' &&
          'text' in payload &&
          typeof payload.text === 'string' &&
          parseCallSignalText(payload.text)?.kind === 'offer',
      )

    expect(offerSignals).toHaveLength(1)
    expect(parseCallSignalText(offerSignals[0].text)).toEqual(
      expect.objectContaining({
        callId: 'call-1',
      }),
    )
  })

  test('shows a secure-origin error when audio call is started from an insecure page', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockResolvedValue([{ chatId: 'chat-1', username: 'bob' }])
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'bob', lastPingTime: null }])
    apiMocks.mockFetchMessages.mockResolvedValue([
      {
        chatId: 'chat-1',
        senderUserId: 'bob',
        text: 'Ready for a call',
        timestamp: '2026-04-12T10:00:00Z',
      },
    ])

    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: false,
    })

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

    await user.click(screen.getByRole('button', { name: 'start audio call' }))

    await waitFor(() => {
      expect(screen.getByTestId('call-phase')).toHaveTextContent('idle')
      expect(screen.getByTestId('event-log')).toHaveTextContent(
        'Audio calling requires HTTPS or localhost. Open the app over a secure origin and try again.',
      )
    })
  })

  test('keeps hidden call signaling out of chat history and unread state', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockResolvedValue([{ chatId: 'chat-1', username: 'bob' }])
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'bob', lastPingTime: null }])
    apiMocks.mockFetchMessages.mockResolvedValue([
      {
        chatId: 'chat-1',
        senderUserId: 'bob',
        text: 'Visible hello',
        timestamp: '2026-04-12T10:00:00Z',
      },
      {
        chatId: 'chat-1',
        senderUserId: 'bob',
        text: buildCallSignalText({
          version: 1,
          kind: 'offer',
          chatId: 'chat-1',
          callId: 'call-remote',
          sdp: 'remote-offer',
        }),
        timestamp: '2026-04-12T10:01:00Z',
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
      expect(screen.getByTestId('message-count')).toHaveTextContent('1')
      expect(screen.getByTestId('last-message')).toHaveTextContent('Visible hello')
    })

    await act(async () => {
      socket.emitMessage(
        JSON.stringify({
          type: 'MESSAGE',
          chatId: 'chat-1',
          senderUserId: 'bob',
          text: buildCallSignalText({
            version: 1,
            kind: 'offer',
            chatId: 'chat-1',
            callId: 'call-incoming',
            sdp: 'incoming-offer',
          }),
          timestamp: '2026-04-12T10:02:00Z',
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('call-phase')).toHaveTextContent('incoming')
      expect(screen.getByTestId('message-count')).toHaveTextContent('1')
      expect(screen.getByTestId('last-message')).toHaveTextContent('Visible hello')
    })
  })

  test('clears the active call state when the remote peer rejects the call', async () => {
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

    await user.click(screen.getByRole('button', { name: 'start audio call' }))

    await waitFor(() => {
      expect(screen.getByTestId('call-phase')).toHaveTextContent('outgoing')
    })

    await act(async () => {
      socket.emitMessage(
        JSON.stringify({
          type: 'MESSAGE',
          chatId: 'chat-1',
          senderUserId: 'bob',
          text: buildCallSignalText({
            version: 1,
            kind: 'reject',
            chatId: 'chat-1',
            callId: 'call-1',
            reason: 'busy',
          }),
          timestamp: '2026-04-12T10:03:00Z',
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('call-phase')).toHaveTextContent('idle')
      expect(screen.getByTestId('local-stream')).toHaveTextContent('no')
      expect(screen.getByTestId('remote-stream')).toHaveTextContent('no')
    })
  })

  test('clears the active call state when the remote peer ends the call', async () => {
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

    await user.click(screen.getByRole('button', { name: 'start audio call' }))

    await waitFor(() => {
      expect(screen.getByTestId('call-phase')).toHaveTextContent('outgoing')
    })

    await act(async () => {
      socket.emitMessage(
        JSON.stringify({
          type: 'MESSAGE',
          chatId: 'chat-1',
          senderUserId: 'bob',
          text: buildCallSignalText({
            version: 1,
            kind: 'end',
            chatId: 'chat-1',
            callId: 'call-1',
          }),
          timestamp: '2026-04-12T10:04:00Z',
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('call-phase')).toHaveTextContent('idle')
      expect(screen.getByTestId('local-stream')).toHaveTextContent('no')
      expect(screen.getByTestId('remote-stream')).toHaveTextContent('no')
    })
  })

  test('declines an incoming call from the currently open chat', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockResolvedValue([{ chatId: 'chat-1', username: 'bob' }])
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'bob', lastPingTime: null }])
    apiMocks.mockFetchMessages.mockResolvedValue([
      {
        chatId: 'chat-1',
        senderUserId: 'bob',
        text: 'Visible hello',
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
      expect(screen.getByTestId('message-count')).toHaveTextContent('1')
    })

    await act(async () => {
      socket.emitMessage(
        JSON.stringify({
          type: 'MESSAGE',
          chatId: 'chat-1',
          senderUserId: 'bob',
          text: buildCallSignalText({
            version: 1,
            kind: 'offer',
            chatId: 'chat-1',
            callId: 'call-incoming',
            sdp: 'incoming-offer',
          }),
          timestamp: '2026-04-12T10:02:00Z',
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('call-phase')).toHaveTextContent('incoming')
      expect(screen.getByTestId('message-count')).toHaveTextContent('1')
    })

    await user.click(screen.getByRole('button', { name: 'decline audio call' }))

    const rejectPayload = apiMocks.mockSendWebSocketCommand.mock.calls
      .map(([, payload]) => payload)
      .find(
        (payload): payload is { type: string; chatId: string; text: string } =>
          typeof payload === 'object' &&
          payload !== null &&
          'type' in payload &&
          payload.type === 'MESSAGE' &&
          'chatId' in payload &&
          typeof payload.chatId === 'string' &&
          'text' in payload &&
          typeof payload.text === 'string' &&
          parseCallSignalText(payload.text)?.kind === 'reject',
      )

    await waitFor(() => {
      expect(screen.getByTestId('call-phase')).toHaveTextContent('idle')
      expect(screen.getByTestId('message-count')).toHaveTextContent('1')
      expect(screen.getByTestId('last-message')).toHaveTextContent('Visible hello')
    })

    expect(parseCallSignalText(String(rejectPayload?.text))).toEqual(
      expect.objectContaining({
        version: 1,
        kind: 'reject',
        chatId: 'chat-1',
        callId: 'call-incoming',
        reason: 'declined',
      }),
    )
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
