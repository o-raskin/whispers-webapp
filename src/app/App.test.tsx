import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import {
  DEFAULT_WS_URL,
  getWebRtcPeerConnectionConfig,
  PRESENCE_PING_INTERVAL_MS,
} from '../shared/config/backend'
import { buildCallSignalText, parseCallSignalText } from '../shared/utils/callSignals'
import {
  createDeferredPromise,
  emitSocketOpen,
  getLatestMockWebSocket,
  installRealtimeAppBrowserMocks,
  MockMediaStream,
  MockRTCPeerConnection,
  resetRealtimeAppBrowserMocks,
  setSecureContext,
} from './testUtils/realtimeAppTestUtils'

const apiMocks = vi.hoisted(() => ({
  mockBuildWebSocketProtocols: vi.fn((accessToken: string) => [
    `whispers.bearer.${accessToken}`,
  ]),
  mockBuildWebSocketUrl: vi.fn((serverUrl: string) => serverUrl),
  mockCreateChat: vi.fn(),
  mockFetchChats: vi.fn(),
  mockFetchMessages: vi.fn(),
  mockFetchUserProfile: vi.fn(async (_serverUrl: string, _accessToken: string, username: string) => ({
    userId: `profile:${username}`,
    username,
    firstName: username === 'bob' ? 'Bob' : 'Carol',
    lastName: 'Example',
    profileUrl: `https://example.com/${username}.png`,
    provider: 'google',
  })),
  mockFetchUsers: vi.fn(),
  mockSendWebSocketCommand: vi.fn(
    (socket: { send: (payload: string) => void }, payload: unknown) => {
      socket.send(JSON.stringify(payload))
    },
  ),
}))

const privateApiMocks = vi.hoisted(() => ({
  mockCreatePrivateChat: vi.fn(),
  mockFetchPrivateChat: vi.fn(),
  mockFetchPrivateMessages: vi.fn(),
}))

const privateServiceMocks = vi.hoisted(() => ({
  mockEnsureRegisteredPrivateChatBrowserIdentity: vi.fn(),
  mockIsPrivateChatSupported: vi.fn(() => true),
  mockLoadPrivateChatBrowserIdentity: vi.fn(),
  mockRegisterPrivateChatBrowserIdentity: vi.fn(),
}))

const privateCryptoMocks = vi.hoisted(() => ({
  mockDecryptPrivateMessage: vi.fn(),
  mockEncryptPrivateMessage: vi.fn(),
  mockImportPrivateChatPublicKey: vi.fn(),
}))

const authMocks = vi.hoisted(() => ({
  mockFetchCurrentUser: vi.fn(),
  mockLoginWithProvider: vi.fn(),
  mockLogoutCurrentSession: vi.fn(),
  mockRefreshSession: vi.fn(),
}))

vi.mock('../shared/api/chatApi', () => ({
  buildWebSocketProtocols: apiMocks.mockBuildWebSocketProtocols,
  buildWebSocketUrl: apiMocks.mockBuildWebSocketUrl,
  createChat: apiMocks.mockCreateChat,
  fetchChats: apiMocks.mockFetchChats,
  fetchMessages: apiMocks.mockFetchMessages,
  fetchUserProfile: apiMocks.mockFetchUserProfile,
  fetchUsers: apiMocks.mockFetchUsers,
  sendWebSocketCommand: apiMocks.mockSendWebSocketCommand,
}))

vi.mock('../shared/api/privateChatApi', () => ({
  createPrivateChat: privateApiMocks.mockCreatePrivateChat,
  fetchPrivateChat: privateApiMocks.mockFetchPrivateChat,
  fetchPrivateMessages: privateApiMocks.mockFetchPrivateMessages,
}))

vi.mock('../shared/private-chat/privateChatService', () => ({
  ensureRegisteredPrivateChatBrowserIdentity:
    privateServiceMocks.mockEnsureRegisteredPrivateChatBrowserIdentity,
  isPrivateChatSupported: privateServiceMocks.mockIsPrivateChatSupported,
  loadPrivateChatBrowserIdentity: privateServiceMocks.mockLoadPrivateChatBrowserIdentity,
  registerPrivateChatBrowserIdentity: privateServiceMocks.mockRegisterPrivateChatBrowserIdentity,
}))

vi.mock('../shared/private-chat/privateChatCrypto', () => ({
  decryptPrivateMessage: privateCryptoMocks.mockDecryptPrivateMessage,
  encryptPrivateMessage: privateCryptoMocks.mockEncryptPrivateMessage,
  importPrivateChatPublicKey: privateCryptoMocks.mockImportPrivateChatPublicKey,
}))

vi.mock('../shared/api/authApi', () => ({
  fetchCurrentUser: authMocks.mockFetchCurrentUser,
  loginWithProvider: authMocks.mockLoginWithProvider,
  logoutCurrentSession: authMocks.mockLogoutCurrentSession,
  refreshSession: authMocks.mockRefreshSession,
}))

vi.mock('../features/connection/components/ConnectionPanel', () => ({
  ConnectionPanel: () => <div data-testid="connection-panel">connection panel</div>,
}))

vi.mock('../features/welcome/components/WelcomeExperience', () => ({
  WelcomeExperience: ({
    authError,
    authStatus,
    currentUser,
    serverUrl,
    status,
    onServerUrlChange,
    onConnect,
    onLogout,
    onStartGoogleLogin,
  }: {
    authError: string | null
    authStatus: string
    currentUser: { email: string } | null
    serverUrl: string
    status: string
    onServerUrlChange: (value: string) => void
    onConnect: () => void
    onLogout: () => void
    onStartGoogleLogin: () => void
  }) => (
    <div data-testid="welcome">
      <div data-testid="welcome-auth-status">{authStatus}</div>
      <div data-testid="welcome-status">{status}</div>
      <div data-testid="welcome-user">{currentUser?.email ?? 'none'}</div>
      {authError ? <div data-testid="welcome-auth-error">{authError}</div> : null}
      <input
        aria-label="welcome server url"
        value={serverUrl}
        onChange={(event) => onServerUrlChange(event.target.value)}
      />
      <button type="button" onClick={onConnect}>
        connect workspace
      </button>
      <button type="button" onClick={onStartGoogleLogin}>
        continue with google
      </button>
      <button type="button" onClick={onLogout}>
        sign out
      </button>
    </div>
  ),
}))

vi.mock('../features/chat-list/components/ChatSidebar', () => ({
  ChatSidebar: ({
    chats,
    isPrivateChatAvailable,
    users,
    selectedChatId,
    newChatUserId,
    onNewChatUserIdChange,
    onCreateDirectChat,
    onCreatePrivateChat,
    onSelectChat,
  }: {
    chats: Array<{ chatId: string; username: string; unreadCount?: number; type?: string }>
    isPrivateChatAvailable: boolean
    users: Record<string, { username: string }>
    selectedChatId: string | null
    newChatUserId: string
    onNewChatUserIdChange: (value: string) => void
    onCreateDirectChat: () => void
    onCreatePrivateChat: () => void
    onSelectChat: (chatId: string) => void
  }) => (
    <div data-testid="sidebar">
      <div data-testid="selected-chat">{selectedChatId ?? 'none'}</div>
      <div data-testid="known-users">{Object.keys(users).join(',')}</div>
      <div data-testid="private-available">{isPrivateChatAvailable ? 'yes' : 'no'}</div>
      <input
        aria-label="new chat user"
        value={newChatUserId}
        onChange={(event) => onNewChatUserIdChange(event.target.value)}
      />
      <button type="button" onClick={onCreateDirectChat}>
        create chat
      </button>
      <button type="button" onClick={onCreatePrivateChat}>
        create private chat
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
    chatType,
    connectionStatus,
    localCallStream,
    onSetUpPrivateChatBrowser,
    thread,
    privateChatState,
    onAcceptCall,
    remoteTypingLabel,
    onDeclineCall,
    onEndCall,
    messageDraft,
    onMessageDraftChange,
    onBackToInbox,
    onSendMessage,
    onStartCall,
    participantProfile,
    remoteCallStream,
  }: {
    callPhase: string
    chatType: string | null
    connectionStatus: string
    localCallStream: MediaStream | null
    onSetUpPrivateChatBrowser: () => void
    privateChatState: { accessState: string; notice: string | null } | null
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
    participantProfile: {
      firstName?: string | null
      lastName?: string | null
      username: string
    } | null
    remoteCallStream: MediaStream | null
  }) => (
    <div data-testid="conversation">
      <div data-testid="participant">{thread?.participant ?? 'none'}</div>
      <div data-testid="participant-profile-name">
        {participantProfile
          ? [participantProfile.firstName, participantProfile.lastName]
              .filter(Boolean)
              .join(' ') || participantProfile.username
          : 'none'}
      </div>
      <div data-testid="message-count">{thread?.messages.length ?? 0}</div>
      <div data-testid="last-message">
        {thread?.messages.at(-1)?.text ?? 'no-messages'}
      </div>
      <div data-testid="typing">{remoteTypingLabel ?? 'none'}</div>
      <div data-testid="call-phase">{callPhase}</div>
      <div data-testid="local-stream">{localCallStream ? 'yes' : 'no'}</div>
      <div data-testid="remote-stream">{remoteCallStream ? 'yes' : 'no'}</div>
      <div data-testid="connection-status">{connectionStatus}</div>
      <div data-testid="chat-type">{chatType ?? 'none'}</div>
      <div data-testid="private-state">{privateChatState?.accessState ?? 'none'}</div>
      <div data-testid="private-notice">{privateChatState?.notice ?? 'none'}</div>
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
      <button type="button" onClick={onSetUpPrivateChatBrowser}>
        set up private chat
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

async function connectAuthenticatedWorkspace() {
  await waitFor(() => {
    expect(getLatestMockWebSocket()).toBeDefined()
  })
  return getLatestMockWebSocket()
}

describe('App', () => {
  beforeEach(() => {
    installRealtimeAppBrowserMocks()
    authMocks.mockRefreshSession.mockResolvedValue({
      accessToken: 'access-token',
      tokenType: 'Bearer',
      expiresInSeconds: 60 * 60,
      user: {
        userId: 'user-1',
        username: 'alice',
        email: 'alice@example.com',
        provider: 'google',
      },
    })
    authMocks.mockFetchCurrentUser.mockResolvedValue({
      userId: 'user-1',
      username: 'alice',
      email: 'alice@example.com',
      provider: 'google',
    })
    authMocks.mockLoginWithProvider.mockReset()
    authMocks.mockLogoutCurrentSession.mockReset()
    privateApiMocks.mockCreatePrivateChat.mockReset()
    privateApiMocks.mockFetchPrivateChat.mockReset()
    privateApiMocks.mockFetchPrivateMessages.mockReset()
    privateServiceMocks.mockEnsureRegisteredPrivateChatBrowserIdentity.mockReset()
    privateServiceMocks.mockIsPrivateChatSupported.mockReset()
    privateServiceMocks.mockLoadPrivateChatBrowserIdentity.mockReset()
    privateServiceMocks.mockRegisterPrivateChatBrowserIdentity.mockReset()
    privateCryptoMocks.mockDecryptPrivateMessage.mockReset()
    privateCryptoMocks.mockEncryptPrivateMessage.mockReset()
    privateCryptoMocks.mockImportPrivateChatPublicKey.mockReset()

    privateServiceMocks.mockIsPrivateChatSupported.mockReturnValue(true)
    privateServiceMocks.mockEnsureRegisteredPrivateChatBrowserIdentity.mockResolvedValue({
      identity: {
        ownerId: 'alice',
        keyId: 'alice-browser-key',
        publicKey: {} as CryptoKey,
        privateKey: {} as CryptoKey,
        publicKeyBase64: 'alice-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
      status: 'existing',
      registeredKey: {
        keyId: 'alice-browser-key',
        publicKey: 'alice-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
    })
    privateServiceMocks.mockLoadPrivateChatBrowserIdentity.mockResolvedValue({
      ownerId: 'alice',
      keyId: 'alice-browser-key',
      publicKey: {} as CryptoKey,
      privateKey: {} as CryptoKey,
      publicKeyBase64: 'alice-public-key',
      algorithm: 'RSA-OAEP',
      format: 'spki',
      createdAt: '2026-04-20T10:00:00Z',
      updatedAt: '2026-04-20T10:00:00Z',
    })
    privateServiceMocks.mockRegisterPrivateChatBrowserIdentity.mockResolvedValue({
      keyId: 'alice-browser-key',
      publicKey: 'alice-public-key',
      algorithm: 'RSA-OAEP',
      format: 'spki',
      status: 'ACTIVE',
      createdAt: '2026-04-20T10:00:00Z',
      updatedAt: '2026-04-20T10:00:00Z',
    })
    privateApiMocks.mockFetchPrivateChat.mockResolvedValue({
      chatId: 'private-chat-1',
      username: 'bob',
      type: 'PRIVATE',
      currentUserKey: {
        keyId: 'alice-browser-key',
        publicKey: 'alice-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
      counterpartKey: {
        keyId: 'bob-browser-key',
        publicKey: 'bob-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
    })
    privateCryptoMocks.mockDecryptPrivateMessage.mockResolvedValue({
      status: 'decrypted',
      text: 'Decrypted hello',
    })
    privateCryptoMocks.mockImportPrivateChatPublicKey.mockResolvedValue({} as CryptoKey)
    privateCryptoMocks.mockEncryptPrivateMessage.mockResolvedValue({
      protocolVersion: 'v1',
      encryptionAlgorithm: 'AES-GCM',
      keyWrapAlgorithm: 'RSA-OAEP',
      ciphertext: 'ciphertext',
      nonce: 'nonce',
      senderKeyId: 'alice-browser-key',
      senderMessageKeyEnvelope: 'sender-envelope',
      recipientKeyId: 'bob-browser-key',
      recipientMessageKeyEnvelope: 'recipient-envelope',
    })
  })

  afterEach(() => {
    resetRealtimeAppBrowserMocks()
    apiMocks.mockBuildWebSocketProtocols.mockClear()
    apiMocks.mockBuildWebSocketUrl.mockClear()
    apiMocks.mockCreateChat.mockReset()
    apiMocks.mockFetchChats.mockReset()
    apiMocks.mockFetchMessages.mockReset()
    apiMocks.mockFetchUserProfile.mockClear()
    apiMocks.mockFetchUsers.mockReset()
    apiMocks.mockSendWebSocketCommand.mockClear()
    authMocks.mockFetchCurrentUser.mockReset()
    authMocks.mockLoginWithProvider.mockReset()
    authMocks.mockLogoutCurrentSession.mockReset()
    authMocks.mockRefreshSession.mockReset()
    privateApiMocks.mockCreatePrivateChat.mockReset()
    privateApiMocks.mockFetchPrivateChat.mockReset()
    privateApiMocks.mockFetchPrivateMessages.mockReset()
    privateServiceMocks.mockEnsureRegisteredPrivateChatBrowserIdentity.mockReset()
    privateServiceMocks.mockIsPrivateChatSupported.mockReset()
    privateServiceMocks.mockLoadPrivateChatBrowserIdentity.mockReset()
    privateServiceMocks.mockRegisterPrivateChatBrowserIdentity.mockReset()
    privateCryptoMocks.mockDecryptPrivateMessage.mockReset()
    privateCryptoMocks.mockEncryptPrivateMessage.mockReset()
    privateCryptoMocks.mockImportPrivateChatPublicKey.mockReset()
  })

  test('hides the welcome overlay after authentication even before websocket open', async () => {
    render(<App />)

    await connectAuthenticatedWorkspace()

    await waitFor(() => {
      expect(screen.queryByTestId('welcome')).not.toBeInTheDocument()
      expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    })
  })

  test('publishes the private browser key during authenticated bootstrap', async () => {
    render(<App />)

    await connectAuthenticatedWorkspace()

    await waitFor(() => {
      expect(
        privateServiceMocks.mockEnsureRegisteredPrivateChatBrowserIdentity,
      ).toHaveBeenCalledWith(DEFAULT_WS_URL, 'access-token', 'alice')
    })
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

    const socket = await connectAuthenticatedWorkspace()
    expect(socket.url).toBe(DEFAULT_WS_URL)
    expect(socket.protocols).toEqual(['whispers.bearer.access-token'])

    await emitSocketOpen(socket)

    await waitFor(() => {
      expect(apiMocks.mockFetchChats).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
        'alice-browser-key',
      )
      expect(apiMocks.mockFetchUsers).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
      )
    })

    await waitFor(() => {
      expect(screen.getByText('chat:bob:1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'chat:bob:1' }))

    await waitFor(() => {
      expect(apiMocks.mockFetchMessages).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
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

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

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
        'access-token',
        'carol',
      )
      expect(screen.getByTestId('selected-chat')).toHaveTextContent('chat-2')
    })

    await act(async () => {
      socket.close()
    })

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('disconnected')
      expect(screen.getByTestId('selected-chat')).toHaveTextContent('none')
    })
  })

  test('creates private chats and sends encrypted websocket payloads', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockImplementation(async () =>
      privateApiMocks.mockCreatePrivateChat.mock.calls.length > 0
        ? [{ chatId: 'private-chat-1', username: 'private-bob', type: 'PRIVATE' }]
        : [],
    )
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'private-bob', lastPingTime: null }])
    privateApiMocks.mockCreatePrivateChat.mockResolvedValue({
      chatId: 'private-chat-1',
      username: 'private-bob',
      type: 'PRIVATE',
      firstName: null,
      lastName: null,
      profileUrl: null,
    })
    privateApiMocks.mockFetchPrivateChat.mockResolvedValue({
      chatId: 'private-chat-1',
      username: 'private-bob',
      type: 'PRIVATE',
      currentUserKey: {
        keyId: 'alice-browser-key',
        publicKey: 'alice-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
      counterpartKey: {
        keyId: 'bob-browser-key',
        publicKey: 'bob-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
    })
    privateApiMocks.mockFetchPrivateMessages.mockResolvedValue([])

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

    await user.type(screen.getByLabelText('new chat user'), 'private-bob')
    await user.click(screen.getByRole('button', { name: 'create private chat' }))

    await waitFor(() => {
      expect(privateApiMocks.mockCreatePrivateChat).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
        'private-bob',
        'alice-browser-key',
      )
      expect(screen.getByTestId('selected-chat')).toHaveTextContent('private-chat-1')
    })

    expect(
      privateServiceMocks.mockEnsureRegisteredPrivateChatBrowserIdentity,
    ).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(screen.getByTestId('chat-type')).toHaveTextContent('PRIVATE')
      expect(screen.getByTestId('private-state')).toHaveTextContent('ready')
    })

    await user.type(screen.getByLabelText('draft'), 'top secret')
    await user.click(screen.getByRole('button', { name: 'send message' }))

    await waitFor(() => {
      expect(privateCryptoMocks.mockEncryptPrivateMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'top secret',
          recipientKeyId: 'bob-browser-key',
        }),
      )
    })

    expect(apiMocks.mockSendWebSocketCommand).toHaveBeenCalledWith(
      expect.objectContaining({ send: expect.any(Function) }),
      expect.objectContaining({
        type: 'PRIVATE_MESSAGE',
        chatId: 'private-chat-1',
        privateMessage: expect.objectContaining({
          ciphertext: 'ciphertext',
          recipientKeyId: 'bob-browser-key',
          senderKeyId: 'alice-browser-key',
        }),
      }),
    )
  })

  test('enriches private chat participant info the same way as direct chats', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockResolvedValue([
      { chatId: 'private-chat-1', username: 'bob', type: 'PRIVATE' },
    ])
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'bob', lastPingTime: null }])
    privateApiMocks.mockFetchPrivateChat.mockResolvedValue({
      chatId: 'private-chat-1',
      username: 'bob',
      type: 'PRIVATE',
      currentUserKey: {
        keyId: 'alice-browser-key',
        publicKey: 'alice-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
      counterpartKey: {
        keyId: 'bob-browser-key',
        publicKey: 'bob-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
    })
    privateApiMocks.mockFetchPrivateMessages.mockResolvedValue([])

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

    await waitFor(() => {
      expect(apiMocks.mockFetchUserProfile).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
        'bob',
      )
    })

    await user.click(screen.getByRole('button', { name: 'chat:bob:0' }))

    await waitFor(() => {
      expect(screen.getByTestId('participant-profile-name')).toHaveTextContent('Bob Example')
      expect(screen.getByTestId('chat-type')).toHaveTextContent('PRIVATE')
    })
  })

  test('shows a recovery state when the private browser key is missing', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockResolvedValue([
      { chatId: 'private-chat-1', username: 'private-bob', type: 'PRIVATE' },
    ])
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'private-bob', lastPingTime: null }])
    privateServiceMocks.mockLoadPrivateChatBrowserIdentity.mockResolvedValue(null)
    privateApiMocks.mockFetchPrivateChat.mockResolvedValue({
      chatId: 'private-chat-1',
      username: 'private-bob',
      type: 'PRIVATE',
      currentUserKey: {
        keyId: 'alice-browser-key',
        publicKey: 'alice-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
      counterpartKey: {
        keyId: 'bob-browser-key',
        publicKey: 'bob-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
    })
    privateApiMocks.mockFetchPrivateMessages.mockResolvedValue([
      {
        chatId: 'private-chat-1',
        senderUserId: 'private-bob',
        chatType: 'PRIVATE',
        encryptedMessage: {
          protocolVersion: 'v1',
          encryptionAlgorithm: 'AES-GCM',
          keyWrapAlgorithm: 'RSA-OAEP',
          ciphertext: 'ciphertext',
          nonce: 'nonce',
          senderKeyId: 'bob-browser-key',
          senderMessageKeyEnvelope: 'sender-envelope',
          recipientKeyId: 'alice-browser-key',
          recipientMessageKeyEnvelope: 'recipient-envelope',
        },
        timestamp: '2026-04-20T10:01:00Z',
      },
    ])

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

    await waitFor(() => {
      expect(screen.getByText('chat:private-bob:0')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'chat:private-bob:0' }))

    await waitFor(() => {
      expect(screen.getByTestId('chat-type')).toHaveTextContent('PRIVATE')
      expect(screen.getByTestId('private-state')).toHaveTextContent('missing-key')
      expect(screen.getByTestId('private-notice')).toHaveTextContent(
        /does not have the saved private key/i,
      )
      expect(screen.getByTestId('last-message')).toHaveTextContent('no-messages')
    })

    expect(privateApiMocks.mockFetchPrivateMessages).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'set up private chat' }))

    await waitFor(() => {
      expect(privateServiceMocks.mockEnsureRegisteredPrivateChatBrowserIdentity).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
        'alice',
      )
      expect(privateApiMocks.mockFetchPrivateMessages).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
        'private-chat-1',
        'alice-browser-key',
      )
      expect(screen.getByTestId('private-state')).toHaveTextContent('ready')
      expect(screen.getByTestId('last-message')).toHaveTextContent('Decrypted hello')
    })
  })

  test('handles invalid connection attempts and socket errors', async () => {
    const user = userEvent.setup()
    authMocks.mockRefreshSession.mockRejectedValueOnce(new Error('No refresh session'))

    const initialRender = render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('welcome-auth-status')).toHaveTextContent(
        'unauthenticated',
      )
    })
    await user.click(screen.getByRole('button', { name: 'connect workspace' }))

    expect(screen.getByTestId('welcome-auth-error')).toHaveTextContent(
      'Sign in first to connect the realtime workspace.',
    )

    authMocks.mockRefreshSession.mockResolvedValueOnce({
      accessToken: 'access-token',
      tokenType: 'Bearer',
      expiresInSeconds: 60 * 60,
      user: {
        userId: 'user-1',
        username: 'alice',
        email: 'alice@example.com',
        provider: 'google',
      },
    })
    initialRender.unmount()
    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
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

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

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

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

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

    expect(MockRTCPeerConnection.instances[0]?.config).toEqual(
      getWebRtcPeerConnectionConfig(),
    )
    expect(MockRTCPeerConnection.instances[0]?.config).not.toHaveProperty('iceTransportPolicy')

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

    installRealtimeAppBrowserMocks({
      getUserMedia: getUserMediaMock,
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('call-1')
        .mockReturnValueOnce('call-2'),
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

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

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

    setSecureContext(false)

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

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

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

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

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

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

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

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

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

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
})
