import { deriveAppViewModel } from './appViewModel'

describe('deriveAppViewModel', () => {
  test('derives the currently selected conversation state for an authenticated desktop session', () => {
    expect(
      deriveAppViewModel({
        authStatus: 'authenticated',
        authUser: {
          userId: 'user-1',
          username: 'alice',
          email: 'alice@example.com',
          displayName: 'Alice Example',
          provider: 'google',
        },
        chats: [
          {
            chatId: 'chat-1',
            username: 'bob',
            type: 'DIRECT',
          },
        ],
        isMobileLayout: false,
        messageDraft: 'hello there',
        privateChatSessions: {},
        remoteTypingByChatId: { 'chat-1': 'bob' },
        selectedChatId: 'chat-1',
        threads: {
          'chat-1': {
            chatId: 'chat-1',
            participant: 'bob',
            messages: [],
          },
        },
        users: {
          bob: {
            username: 'bob',
            lastPingReceivedAt: Date.now(),
            lastPingTime: '2026-04-20T08:00:00Z',
          },
        },
      }),
    ).toMatchObject({
      currentUserId: 'alice',
      isDrafting: true,
      isMobileChatOpen: false,
      remoteTypingLabel: 'bob',
      selectedChatSummary: {
        chatId: 'chat-1',
        username: 'bob',
      },
      selectedThread: {
        chatId: 'chat-1',
        participant: 'bob',
      },
      selectedUser: {
        username: 'bob',
      },
      showWelcome: false,
    })
  })

  test('falls back to the default private chat session when the thread has not been hydrated yet', () => {
    expect(
      deriveAppViewModel({
        authStatus: 'checking',
        authUser: null,
        chats: [
          {
            chatId: 'private-1',
            username: 'bob',
            type: 'PRIVATE',
          },
        ],
        isMobileLayout: true,
        messageDraft: '   ',
        privateChatSessions: {},
        remoteTypingByChatId: {},
        selectedChatId: 'private-1',
        threads: {},
        users: {},
      }),
    ).toMatchObject({
      currentUserId: '',
      isDrafting: false,
      isMobileChatOpen: true,
      selectedPrivateChatSession: {
        accessState: 'idle',
        metadata: null,
        notice: null,
      },
      showWelcome: true,
    })
  })
})
