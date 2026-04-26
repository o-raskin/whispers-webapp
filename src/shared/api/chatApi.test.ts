import {
  buildWebSocketUrl,
  createChat,
  deleteChat,
  deleteMessage,
  editMessage,
  fetchChats,
  fetchMessages,
  fetchUserProfile,
  fetchUsers,
  sendWebSocketCommand,
} from './chatApi'
import type { ChatSummary, MessageRecord, UserPresence } from '../types/chat'

describe('chatApi', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('builds a websocket url without legacy identity query params', () => {
    expect(buildWebSocketUrl('ws://192.168.0.10:8080/ws/user')).toBe(
      'ws://192.168.0.10:8080/ws/user',
    )
  })

  test('serializes websocket commands before sending', () => {
    const socket = { send: vi.fn() } as unknown as WebSocket

    sendWebSocketCommand(socket, { type: 'PRESENCE' })

    expect(socket.send).toHaveBeenCalledWith('{"type":"PRESENCE"}')
  })

  test('fetches chats over the matching HTTP base URL with an optional browser key id', async () => {
    const chats: ChatSummary[] = [
      {
        chatId: 'chat-1',
        username: 'bob',
        type: 'DIRECT',
        firstName: 'Bob',
        lastName: 'Example',
        profileUrl: 'https://example.com/bob.png',
      },
    ]
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(chats),
    })

    await expect(
      fetchChats('ws://192.168.0.10:8080/ws/user', 'access-token', 'alice-browser-key'),
    ).resolves.toEqual(chats)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://192.168.0.10:8080/chats?keyId=alice-browser-key',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer access-token',
        },
      }),
    )
  })

  test('creates chats with a post request and target user id', async () => {
    const chat: ChatSummary = {
      chatId: 'chat-2',
      username: 'carol',
      type: 'DIRECT',
      firstName: 'Carol',
      lastName: 'Example',
      profileUrl: 'https://example.com/carol.png',
    }
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(chat),
    })

    await expect(
      createChat('wss://chat.example.com/ws/user', 'access-token', 'carol'),
    ).resolves.toEqual(chat)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://chat.example.com/chats?targetUserId=carol',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer access-token',
        },
      }),
    )
  })

  test('uses backend error payloads for failed history requests', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: 'History exploded' }),
    })

    await expect(
      fetchMessages('ws://192.168.0.10:8080/ws/user', 'alice', 'chat-1'),
    ).rejects.toThrow('History exploded')
  })

  test('falls back to a default error message when a failed response is not json', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: vi.fn().mockRejectedValue(new Error('bad json')),
    })

    await expect(fetchUsers('ws://192.168.0.10:8080/ws/user', 'alice')).rejects.toThrow(
      'Cannot load users.',
    )
  })

  test('fetches users and messages when the response succeeds', async () => {
    const users: UserPresence[] = [{ username: 'bob', lastPingTime: null }]
    const messagesResponse = [
      {
        chatId: 1,
        messageId: 987,
        senderUserId: 'bob',
        text: 'Hi',
        timestamp: '2026-04-12T10:30:00Z',
        updatedAt: '2026-04-12T10:32:00Z',
      },
    ]
    const messages: MessageRecord[] = [
      {
        chatId: '1',
        messageId: '987',
        senderUserId: 'bob',
        text: 'Hi',
        timestamp: '2026-04-12T10:30:00Z',
        updatedAt: '2026-04-12T10:32:00Z',
      },
    ]

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(users),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(messagesResponse),
      })

    await expect(fetchUsers('ws://192.168.0.10:8080/ws/user', 'alice')).resolves.toEqual(
      users,
    )
    await expect(
      fetchMessages('ws://192.168.0.10:8080/ws/user', 'alice', '1'),
    ).resolves.toEqual(messages)
  })

  test('deletes a message by backend id', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(''),
    })

    await expect(
      deleteMessage('wss://chat.example.com/ws/user', 'access-token', '987'),
    ).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://chat.example.com/messages/987',
      expect.objectContaining({
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer access-token',
        },
      }),
    )
  })

  test('edits a message by backend id', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        chatId: 123,
        messageId: 987,
        senderUserId: 'alice',
        text: 'Updated hello',
        timestamp: '2026-04-12T10:35:00Z',
        updatedAt: '2026-04-12T10:36:00Z',
      }),
    })

    await expect(
      editMessage('wss://chat.example.com/ws/user', 'access-token', '987', 'Updated hello'),
    ).resolves.toEqual({
      chatId: '123',
      messageId: '987',
      senderUserId: 'alice',
      text: 'Updated hello',
      timestamp: '2026-04-12T10:35:00Z',
      updatedAt: '2026-04-12T10:36:00Z',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://chat.example.com/messages/987',
      expect.objectContaining({
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer access-token',
          'Content-Type': 'application/json',
        },
        body: '{"text":"Updated hello"}',
      }),
    )
  })

  test('deletes a chat by backend id', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(''),
    })

    await expect(
      deleteChat('wss://chat.example.com/ws/user', 'access-token', '123'),
    ).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://chat.example.com/chats/123',
      expect.objectContaining({
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer access-token',
        },
      }),
    )
  })

  test('fetches a user profile by user id for direct chat enrichment', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        userId: 'user-2',
        username: 'bob@example.com',
        firstName: 'Bob',
        lastName: 'Example',
        profileUrl: 'https://example.com/bob.png',
        provider: 'google',
      }),
    })

    await expect(
      fetchUserProfile('ws://192.168.0.10:8080/ws/user', 'access-token', 'bob@example.com'),
    ).resolves.toEqual({
      userId: 'user-2',
      username: 'bob@example.com',
      firstName: 'Bob',
      lastName: 'Example',
      profileUrl: 'https://example.com/bob.png',
      provider: 'google',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://192.168.0.10:8080/users/bob%40example.com',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer access-token',
        },
      }),
    )
  })
})
