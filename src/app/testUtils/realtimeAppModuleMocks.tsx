const apiMocks = vi.hoisted(() => ({
  mockBuildWebSocketProtocols: vi.fn((accessToken: string) => [
    `whispers.bearer.${accessToken}`,
  ]),
  mockBuildWebSocketUrl: vi.fn((serverUrl: string) => serverUrl),
  mockCreateChat: vi.fn(),
  mockDeleteChat: vi.fn(),
  mockDeleteMessage: vi.fn(),
  mockEditMessage: vi.fn(),
  mockFetchChats: vi.fn(),
  mockFetchMessages: vi.fn(),
  mockFetchUserProfile: vi.fn(
    async (_serverUrl: string, _accessToken: string, username: string) => ({
      userId: `profile:${username}`,
      username,
      firstName: username === 'bob' ? 'Bob' : 'Carol',
      lastName: 'Example',
      profileUrl: `https://example.com/${username}.png`,
      provider: 'google',
    }),
  ),
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

vi.mock('../../shared/api/chatApi', () => ({
  buildWebSocketProtocols: apiMocks.mockBuildWebSocketProtocols,
  buildWebSocketUrl: apiMocks.mockBuildWebSocketUrl,
  createChat: apiMocks.mockCreateChat,
  deleteChat: apiMocks.mockDeleteChat,
  deleteMessage: apiMocks.mockDeleteMessage,
  editMessage: apiMocks.mockEditMessage,
  fetchChats: apiMocks.mockFetchChats,
  fetchMessages: apiMocks.mockFetchMessages,
  fetchUserProfile: apiMocks.mockFetchUserProfile,
  fetchUsers: apiMocks.mockFetchUsers,
  sendWebSocketCommand: apiMocks.mockSendWebSocketCommand,
}))

vi.mock('../../shared/api/privateChatApi', () => ({
  createPrivateChat: privateApiMocks.mockCreatePrivateChat,
  fetchPrivateChat: privateApiMocks.mockFetchPrivateChat,
  fetchPrivateMessages: privateApiMocks.mockFetchPrivateMessages,
}))

vi.mock('../../shared/private-chat/privateChatService', () => ({
  ensureRegisteredPrivateChatBrowserIdentity:
    privateServiceMocks.mockEnsureRegisteredPrivateChatBrowserIdentity,
  isPrivateChatSupported: privateServiceMocks.mockIsPrivateChatSupported,
  loadPrivateChatBrowserIdentity: privateServiceMocks.mockLoadPrivateChatBrowserIdentity,
  registerPrivateChatBrowserIdentity: privateServiceMocks.mockRegisterPrivateChatBrowserIdentity,
}))

vi.mock('../../shared/private-chat/privateChatCrypto', () => ({
  decryptPrivateMessage: privateCryptoMocks.mockDecryptPrivateMessage,
  encryptPrivateMessage: privateCryptoMocks.mockEncryptPrivateMessage,
  importPrivateChatPublicKey: privateCryptoMocks.mockImportPrivateChatPublicKey,
}))

vi.mock('../../shared/api/authApi', () => ({
  fetchCurrentUser: authMocks.mockFetchCurrentUser,
  loginWithProvider: authMocks.mockLoginWithProvider,
  logoutCurrentSession: authMocks.mockLogoutCurrentSession,
  refreshSession: authMocks.mockRefreshSession,
}))

vi.mock('../../features/connection/components/ConnectionPanel', () => ({
  ConnectionPanel: () => <div data-testid="connection-panel">connection panel</div>,
}))

vi.mock('../../features/welcome/components/WelcomeExperience', () => ({
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

vi.mock('../../features/chat-list/components/ChatSidebar', () => ({
  ChatSidebar: ({
    chats,
    isPrivateChatAvailable,
    users,
    selectedChatId,
    newChatUserId,
    onNewChatUserIdChange,
    onCreateDirectChat,
    onCreatePrivateChat,
    onDeleteChat,
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
    onDeleteChat: (chatId: string) => void
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
        <div key={chat.chatId}>
          <button
            type="button"
            onClick={() => onSelectChat(chat.chatId)}
          >
            {`chat:${chat.username}:${chat.unreadCount ?? 0}`}
          </button>
          <button type="button" onClick={() => onDeleteChat(chat.chatId)}>
            {`delete-chat:${chat.username}`}
          </button>
        </div>
      ))}
    </div>
  ),
}))

vi.mock('../../features/conversation/components/ConversationPanel', () => ({
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
    onCancelMessageEdit,
    onEditMessage,
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
    thread: {
      participant: string
      messages: Array<{ direction: string; text: string }>
    } | null
    remoteTypingLabel: string | null
    onAcceptCall: () => void
    onDeclineCall: () => void
    onEndCall: () => void
    onEditMessage: (message: { chatId: string; messageId: string; text: string }) => void
    onCancelMessageEdit: () => void
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
  }) => {
    const privateChatAccessState = privateChatState?.accessState ?? 'idle'
    const isPrivateComposerLocked =
      chatType === 'PRIVATE' &&
      (
        privateChatAccessState === 'missing-key' ||
        privateChatAccessState === 'setting-up' ||
        privateChatAccessState === 'error'
      )
    const isDraftDisabled =
      !thread || connectionStatus !== 'connected' || isPrivateComposerLocked

    return (
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
        <div data-testid="last-direction">
          {thread?.messages.at(-1)?.direction ?? 'none'}
        </div>
        <div data-testid="draft-disabled">{String(isDraftDisabled)}</div>
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
        <button
          type="button"
          onClick={() => onEditMessage({ chatId: 'chat-1', messageId: 'own-1', text: 'Own hello' })}
        >
          edit own message
        </button>
        <button type="button" onClick={onCancelMessageEdit}>
          cancel message edit
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
    )
  },
}))

vi.mock('../../features/event-log/components/EventLogPanel', () => ({
  EventLogPanel: ({ lines }: { lines: string[] }) => (
    <div data-testid="event-log">
      {lines.map((line, index) => (
        <div key={`${line}-${index}`}>{line}</div>
      ))}
    </div>
  ),
}))

export {
  apiMocks,
  authMocks,
  privateApiMocks,
  privateCryptoMocks,
  privateServiceMocks,
}
