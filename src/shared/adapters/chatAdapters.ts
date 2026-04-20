import type { ChatMessage, MessageRecord, PrivateMessageRecord } from '../types/chat'

export function toMessageId(message: MessageRecord): string {
  return `${message.chatId}-${message.senderUserId}-${message.timestamp}-${message.text}`
}

export function toChatMessage(
  message: MessageRecord,
  currentUserId: string,
): ChatMessage {
  return {
    id: toMessageId(message),
    chatId: message.chatId,
    senderUserId: message.senderUserId,
    text: message.text,
    timestamp: message.timestamp,
    direction:
      message.senderUserId === currentUserId
        ? ('sent' as const)
        : ('received' as const),
  }
}

export function toPrivateMessageId(message: PrivateMessageRecord): string {
  return [
    message.chatId,
    message.senderUserId,
    message.timestamp,
    message.encryptedMessage.senderKeyId,
    message.encryptedMessage.nonce,
  ].join('-')
}
