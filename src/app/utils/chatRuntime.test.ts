import { buildCallSignalText } from '../../shared/utils/callSignals'
import type { ChatMessage, ChatSummary } from '../../shared/types/chat'
import {
  applyIncomingMessageToChats,
  clearChatUnreadCount,
  createSystemMessage,
  filterVisibleMessages,
  hydrateFetchedChats,
  mergeFetchedChats,
  mergeThreadMessages,
  setChatPreview,
  setChatTimestamp,
  upsertThread,
} from './chatRuntime'

function createChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: overrides.id ?? 'message-1',
    chatId: overrides.chatId ?? 'chat-1',
    senderUserId: overrides.senderUserId ?? 'bob',
    direction: overrides.direction ?? 'received',
    text: overrides.text ?? 'Hello',
    timestamp: overrides.timestamp ?? '2026-04-12T10:00:00Z',
    ...(overrides.encryption ? { encryption: overrides.encryption } : {}),
  }
}

describe('chatRuntime', () => {
  test('filters hidden call signaling from fetched message history', () => {
    expect(
      filterVisibleMessages([
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
            callId: 'call-1',
            sdp: 'mock-offer',
          }),
          timestamp: '2026-04-12T10:01:00Z',
        },
      ]),
    ).toEqual([
      {
        chatId: 'chat-1',
        senderUserId: 'bob',
        text: 'Visible hello',
        timestamp: '2026-04-12T10:00:00Z',
      },
    ])
  })

  test('creates and merges thread messages without duplicating ids', () => {
    const existing = [
      createChatMessage({
        id: 'message-2',
        text: 'Second',
        timestamp: '2026-04-12T10:02:00Z',
      }),
    ]
    const incoming = [
      createChatMessage({
        id: 'message-1',
        text: 'First',
        timestamp: '2026-04-12T10:01:00Z',
      }),
      createChatMessage({
        id: 'message-2',
        text: 'Second duplicate',
        timestamp: '2026-04-12T10:02:00Z',
      }),
    ]

    expect(mergeThreadMessages(existing, incoming)).toEqual([
      createChatMessage({
        id: 'message-1',
        text: 'First',
        timestamp: '2026-04-12T10:01:00Z',
      }),
      createChatMessage({
        id: 'message-2',
        text: 'Second',
        timestamp: '2026-04-12T10:02:00Z',
      }),
    ])

    expect(
      upsertThread(
        {},
        'chat-1',
        'bob',
        [createChatMessage({ id: 'message-3', text: 'Newest' })],
      ),
    ).toEqual({
      'chat-1': {
        chatId: 'chat-1',
        participant: 'bob',
        messages: [createChatMessage({ id: 'message-3', text: 'Newest' })],
      },
    })
  })

  test('upgrades a locked private placeholder when the browser can decrypt it later', () => {
    const placeholder = createChatMessage({
      id: 'private-message-1',
      text: 'Encrypted message unavailable on this browser.',
      encryption: {
        mode: 'PRIVATE',
        state: 'missing-key',
      },
    })
    const decrypted = createChatMessage({
      id: 'private-message-1',
      text: 'Recovered private text',
      encryption: {
        mode: 'PRIVATE',
        state: 'decrypted',
      },
    })

    expect(mergeThreadMessages([placeholder], [decrypted])).toEqual([decrypted])
  })

  test('preserves visible chat previews when fetched chat summaries contain hidden call signals', () => {
    const currentChats: ChatSummary[] = [
      {
        chatId: 'chat-1',
        username: 'bob',
        preview: 'Visible preview',
        lastMessageTimestamp: '2026-04-12T10:00:00Z',
        unreadCount: 2,
      },
    ]

    expect(
      mergeFetchedChats(currentChats, [
        {
          chatId: 'chat-1',
          username: 'bob',
          preview: buildCallSignalText({
            version: 1,
            kind: 'end',
            chatId: 'chat-1',
            callId: 'call-1',
          }),
          lastMessageTimestamp: '2026-04-12T10:05:00Z',
        },
      ]),
    ).toEqual(currentChats)
  })

  test('hydrates fetched chats while protecting newer summaries and zeroing the open chat unread state', () => {
    const currentChats: ChatSummary[] = [
      {
        chatId: 'chat-1',
        username: 'bob',
        preview: 'Existing preview',
        lastMessageTimestamp: '2026-04-12T10:06:00Z',
        unreadCount: 3,
      },
      {
        chatId: 'chat-2',
        username: 'carol',
        preview: 'Earlier note',
        lastMessageTimestamp: '2026-04-12T09:58:00Z',
        unreadCount: 1,
      },
    ]

    const hydratedByChatId = new Map([
      [
        'chat-1',
        {
          preview: 'Older hydrated preview',
          lastMessageTimestamp: '2026-04-12T10:05:00Z',
          unreadCount: 4,
        },
      ],
      [
        'chat-2',
        {
          preview: 'Hydrated preview',
          lastMessageTimestamp: '2026-04-12T10:07:00Z',
          unreadCount: 5,
        },
      ],
    ])

    expect(hydrateFetchedChats(currentChats, hydratedByChatId, 'chat-2')).toEqual([
      currentChats[0],
      {
        chatId: 'chat-2',
        username: 'carol',
        preview: 'Hydrated preview',
        lastMessageTimestamp: '2026-04-12T10:07:00Z',
        unreadCount: 0,
      },
    ])
  })

  test('updates chat summaries and unread counts when incoming messages arrive', () => {
    const currentChats: ChatSummary[] = [
      {
        chatId: 'chat-1',
        username: 'bob',
        preview: 'Previous',
        lastMessageTimestamp: '2026-04-12T10:00:00Z',
        unreadCount: 1,
      },
    ]
    const incomingMessage = createChatMessage({
      text: 'Fresh update',
      timestamp: '2026-04-12T10:10:00Z',
    })

    expect(
      applyIncomingMessageToChats(currentChats, incomingMessage, null, 'alice'),
    ).toEqual([
      {
        chatId: 'chat-1',
        username: 'bob',
        preview: 'Fresh update',
        lastMessageTimestamp: '2026-04-12T10:10:00Z',
        unreadCount: 2,
      },
    ])

    expect(
      applyIncomingMessageToChats(currentChats, incomingMessage, 'chat-1', 'alice'),
    ).toEqual([
      {
        chatId: 'chat-1',
        username: 'bob',
        preview: 'Fresh update',
        lastMessageTimestamp: '2026-04-12T10:10:00Z',
        unreadCount: 0,
      },
    ])

    expect(
      applyIncomingMessageToChats(
        currentChats,
        createChatMessage({ senderUserId: 'alice', direction: 'sent' }),
        null,
        'alice',
      ),
    ).toEqual([
      {
        chatId: 'chat-1',
        username: 'bob',
        preview: 'Hello',
        lastMessageTimestamp: '2026-04-12T10:00:00Z',
        unreadCount: 0,
      },
    ])
  })

  test('exposes small chat-summary helpers for preview, timestamp, unread clearing, and system messages', () => {
    const chats: ChatSummary[] = [
      {
        chatId: 'chat-1',
        username: 'bob',
        preview: 'Previous',
        lastMessageTimestamp: '2026-04-12T10:00:00Z',
        unreadCount: 2,
      },
    ]

    expect(setChatPreview(chats, 'chat-1', 'Updated preview')[0].preview).toBe(
      'Updated preview',
    )
    expect(
      setChatTimestamp(chats, 'chat-1', '2026-04-12T10:10:00Z')[0].lastMessageTimestamp,
    ).toBe('2026-04-12T10:10:00Z')
    expect(clearChatUnreadCount(chats, 'chat-1')[0].unreadCount).toBe(0)

    const systemMessage = createSystemMessage('chat-1', 'Connection lost')
    expect(systemMessage.chatId).toBe('chat-1')
    expect(systemMessage.direction).toBe('system')
    expect(systemMessage.text).toBe('Connection lost')
  })
})
