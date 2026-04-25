import { toChatMessage, toMessageId } from './chatAdapters'
import type { MessageRecord } from '../types/chat'

describe('chatAdapters', () => {
  const message: MessageRecord = {
    chatId: 'chat-1',
    senderUserId: 'alice',
    text: 'Hello there',
    timestamp: '2026-04-12T10:30:00Z',
  }

  test('builds a stable message id from message fields', () => {
    expect(toMessageId(message)).toBe(
      'chat-1-alice-2026-04-12T10:30:00Z-Hello there',
    )
  })

  test('prefers the backend message id when it is available', () => {
    expect(toMessageId({ ...message, messageId: '987' })).toBe('message-987')
  })

  test('maps a current-user message to a sent chat message', () => {
    expect(toChatMessage(message, 'alice')).toEqual({
      id: 'chat-1-alice-2026-04-12T10:30:00Z-Hello there',
      chatId: 'chat-1',
      senderUserId: 'alice',
      text: 'Hello there',
      timestamp: '2026-04-12T10:30:00Z',
      direction: 'sent',
    })
  })

  test('maps another user message to a received chat message', () => {
    expect(toChatMessage(message, 'bob').direction).toBe('received')
  })
})
