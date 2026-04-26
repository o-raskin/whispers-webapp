import { buildCallSignalText } from '../../shared/utils/callSignals'
import type { ChatMessage, ChatSummary } from '../../shared/types/chat'
import {
  applyIncomingMessageToChats,
  canDeleteChat,
  clearChatUnreadCount,
  createSystemMessage,
  editMessageInThread,
  filterVisibleMessages,
  hydrateFetchedChats,
  mergeFetchedChats,
  mergeThreadMessages,
  removeChatFromList,
  removeMessageFromThread,
  setChatPreview,
  setChatTimestamp,
  syncChatAfterMessageEdit,
  syncChatAfterMessageRemoval,
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
    ...(typeof overrides.updatedAt !== 'undefined' ? { updatedAt: overrides.updatedAt } : {}),
    ...(overrides.messageId ? { messageId: overrides.messageId } : {}),
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

  test('removes deleted messages from a thread and refreshes chat preview from remaining messages', () => {
    const currentThreads = {
      'chat-1': {
        chatId: 'chat-1',
        participant: 'bob',
        messages: [
          createChatMessage({
            id: 'message-987',
            messageId: '987',
            text: 'Older note',
            timestamp: '2026-04-12T10:00:00Z',
          }),
          createChatMessage({
            id: 'message-988',
            messageId: '988',
            text: 'Delete me',
            timestamp: '2026-04-12T10:05:00Z',
          }),
        ],
      },
    }
    const nextThreads = removeMessageFromThread(currentThreads, 'chat-1', '988')

    expect(nextThreads['chat-1'].messages).toEqual([
      createChatMessage({
        id: 'message-987',
        messageId: '987',
        text: 'Older note',
        timestamp: '2026-04-12T10:00:00Z',
      }),
    ])
    expect(
      syncChatAfterMessageRemoval(
        [
          {
            chatId: 'chat-1',
            username: 'bob',
            preview: 'Delete me',
            lastMessageTimestamp: '2026-04-12T10:05:00Z',
          },
        ],
        'chat-1',
        nextThreads['chat-1'].messages,
      ),
    ).toEqual([
      {
        chatId: 'chat-1',
        username: 'bob',
        preview: 'Older note',
        lastMessageTimestamp: '2026-04-12T10:00:00Z',
      },
    ])
  })

  test('edits messages in place and refreshes the latest chat preview', () => {
    const currentThreads = {
      'chat-1': {
        chatId: 'chat-1',
        participant: 'bob',
        messages: [
          createChatMessage({
            id: 'message-987',
            messageId: '987',
            text: 'Older note',
            timestamp: '2026-04-12T10:00:00Z',
          }),
          createChatMessage({
            id: 'message-988',
            messageId: '988',
            text: 'Original latest',
            timestamp: '2026-04-12T10:05:00Z',
          }),
        ],
      },
    }
    const editedMessage = createChatMessage({
      id: 'message-988',
      messageId: '988',
      senderUserId: 'alice',
      direction: 'sent',
      text: 'Edited latest',
      timestamp: '2026-04-12T10:05:00Z',
      updatedAt: '2026-04-12T10:06:00Z',
    })
    const nextThreads = editMessageInThread(currentThreads, editedMessage)

    expect(nextThreads['chat-1'].messages.at(-1)).toEqual(editedMessage)
    expect(
      syncChatAfterMessageEdit(
        [
          {
            chatId: 'chat-1',
            username: 'bob',
            preview: 'Original latest',
            lastMessageTimestamp: '2026-04-12T10:05:00Z',
          },
        ],
        editedMessage,
        currentThreads,
      ),
    ).toEqual([
      {
        chatId: 'chat-1',
        username: 'bob',
        preview: 'Edited latest',
        lastMessageTimestamp: '2026-04-12T10:05:00Z',
      },
    ])
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

  test('removes deleted chats and gates group deletion to the creator', () => {
    const chats: ChatSummary[] = [
      { chatId: 'chat-1', username: 'bob', type: 'DIRECT' },
      { chatId: 'group-1', username: 'team', type: 'GROUP', creatorUserId: 'alice' },
    ]

    expect(removeChatFromList(chats, 'chat-1')).toEqual([
      { chatId: 'group-1', username: 'team', type: 'GROUP', creatorUserId: 'alice' },
    ])
    expect(canDeleteChat(chats[0], 'alice')).toBe(true)
    expect(canDeleteChat(chats[1], 'alice')).toBe(true)
    expect(canDeleteChat(chats[1], 'bob')).toBe(false)
  })
})
