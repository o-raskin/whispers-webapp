import {
  buildWebSocketUrl,
  createChat,
  fetchChats,
  fetchMessages,
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

  test('builds a websocket url with the user id query param', () => {
    expect(buildWebSocketUrl('ws://192.168.0.10:8080/ws/user', 'alice')).toBe(
      'ws://192.168.0.10:8080/ws/user?userId=alice',
    )
  })

  test('serializes websocket commands before sending', () => {
    const socket = { send: vi.fn() } as unknown as WebSocket

    sendWebSocketCommand(socket, { type: 'PRESENCE' })

    expect(socket.send).toHaveBeenCalledWith('{"type":"PRESENCE"}')
  })

  test('fetches chats over the matching HTTP base URL', async () => {
    const chats: ChatSummary[] = [{ chatId: 'chat-1', username: 'bob' }]
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(chats),
    })

    await expect(fetchChats('ws://192.168.0.10:8080/ws/user', 'alice')).resolves.toEqual(
      chats,
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'http://192.168.0.10:8080/chats?userId=alice',
      expect.objectContaining({
        headers: { Accept: 'application/json' },
      }),
    )
  })

  test('creates chats with a post request and target user id', async () => {
    const chat: ChatSummary = { chatId: 'chat-2', username: 'carol' }
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(chat),
    })

    await expect(
      createChat('wss://chat.example.com/ws/user', 'alice', 'carol'),
    ).resolves.toEqual(chat)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://chat.example.com/chats?userId=alice&targetUserId=carol',
      expect.objectContaining({
        method: 'POST',
        headers: { Accept: 'application/json' },
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
    const messages: MessageRecord[] = [
      {
        chatId: 'chat-1',
        senderUserId: 'bob',
        text: 'Hi',
        timestamp: '2026-04-12T10:30:00Z',
      },
    ]

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(users),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(messages),
      })

    await expect(fetchUsers('ws://192.168.0.10:8080/ws/user', 'alice')).resolves.toEqual(
      users,
    )
    await expect(
      fetchMessages('ws://192.168.0.10:8080/ws/user', 'alice', 'chat-1'),
    ).resolves.toEqual(messages)
  })
})
