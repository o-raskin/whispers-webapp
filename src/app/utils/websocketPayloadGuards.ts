import type {
  MessageRecord,
  PrivateMessageRecord,
  PresenceEvent,
  TypingEvent,
} from '../../shared/types/chat'

export type WebSocketMessageRecordPayload = Omit<MessageRecord, 'chatId'> & {
  chatId: string | number
}

export type WebSocketPrivateMessagePayload = Omit<
  PrivateMessageRecord,
  'chatId' | 'senderUserId'
> & {
  chatId: string | number
  senderUsername: string
}

export function isPresenceEvent(payload: unknown): payload is PresenceEvent {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'type' in payload &&
    (payload.type === 'presence' || payload.type === 'PRESENCE')
  )
}

export function isTypingEvent(payload: unknown): payload is TypingEvent {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'type' in payload &&
    (
      payload.type === 'typing:start' ||
      payload.type === 'typing:stop' ||
      payload.type === 'TYPING_START' ||
      payload.type === 'TYPING_END'
    )
  )
}

export function hasTypedEventShape(
  payload: unknown,
): payload is Record<'type', unknown> {
  return typeof payload === 'object' && payload !== null && 'type' in payload
}

export function isMessageRecord(payload: unknown): payload is WebSocketMessageRecordPayload {
  if (typeof payload !== 'object' || payload === null) {
    return false
  }

  const record = payload as {
    chatId?: unknown
    senderUserId?: unknown
    text?: unknown
    timestamp?: unknown
  }

  return (
    (typeof record.chatId === 'string' || typeof record.chatId === 'number') &&
    typeof record.senderUserId === 'string' &&
    typeof record.text === 'string' &&
    typeof record.timestamp === 'string'
  )
}

export function isPrivateMessageRecord(
  payload: unknown,
): payload is WebSocketPrivateMessagePayload {
  if (typeof payload !== 'object' || payload === null) {
    return false
  }

  const record = payload as {
    chatId?: unknown
    chatType?: unknown
    encryptedMessage?: {
      ciphertext?: unknown
      encryptionAlgorithm?: unknown
      keyWrapAlgorithm?: unknown
      nonce?: unknown
      protocolVersion?: unknown
      recipientKeyId?: unknown
      recipientMessageKeyEnvelope?: unknown
      senderKeyId?: unknown
      senderMessageKeyEnvelope?: unknown
    }
    senderUsername?: unknown
    timestamp?: unknown
  }

  return (
    (typeof record.chatId === 'string' || typeof record.chatId === 'number') &&
    record.chatType === 'PRIVATE' &&
    typeof record.senderUsername === 'string' &&
    typeof record.timestamp === 'string' &&
    typeof record.encryptedMessage?.protocolVersion === 'string' &&
    typeof record.encryptedMessage?.encryptionAlgorithm === 'string' &&
    typeof record.encryptedMessage?.keyWrapAlgorithm === 'string' &&
    typeof record.encryptedMessage?.ciphertext === 'string' &&
    typeof record.encryptedMessage?.nonce === 'string' &&
    typeof record.encryptedMessage?.senderKeyId === 'string' &&
    typeof record.encryptedMessage?.senderMessageKeyEnvelope === 'string' &&
    typeof record.encryptedMessage?.recipientKeyId === 'string' &&
    typeof record.encryptedMessage?.recipientMessageKeyEnvelope === 'string'
  )
}
