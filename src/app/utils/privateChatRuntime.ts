import { toPrivateMessageId } from '../../shared/adapters/chatAdapters'
import type { PrivateChatView, PrivateMessageRecord } from '../../shared/types/chat'
import type { PrivateChatDecryptionResult } from '../../shared/private-chat/privateChatCrypto'
import type { WebSocketPrivateMessagePayload } from './websocketPayloadGuards'

export type PrivateChatAccessState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'missing-key'
  | 'setting-up'
  | 'error'

export interface PrivateChatSessionState {
  accessState: PrivateChatAccessState
  metadata: PrivateChatView | null
  notice: string | null
}

export const DEFAULT_PRIVATE_CHAT_SESSION_STATE: PrivateChatSessionState = {
  accessState: 'idle',
  metadata: null,
  notice: null,
}

export const PRIVATE_CHAT_READY_NOTICE =
  'Private messages are end-to-end encrypted and tied to this browser.'
export const PRIVATE_CHAT_MISSING_KEY_NOTICE =
  'This browser does not have the saved private key, so older private messages stay locked here.'
export const PRIVATE_CHAT_SETUP_NOTICE =
  'Set up this browser to keep sending new private messages in this chat.'
export const PRIVATE_CHAT_ERROR_NOTICE =
  'Private messaging is temporarily unavailable in this browser.'

export function normalizeSocketPrivateMessage(
  payload: WebSocketPrivateMessagePayload,
): PrivateMessageRecord {
  return {
    chatId: String(payload.chatId),
    senderUserId: payload.senderUsername,
    chatType: 'PRIVATE',
    encryptedMessage: payload.encryptedMessage,
    timestamp: payload.timestamp,
  }
}

function getPrivateMessageFallbackText(result: Extract<PrivateChatDecryptionResult, { status: 'error' | 'missing-key' }>) {
  if (result.status === 'missing-key') {
    return 'Encrypted message unavailable on this browser.'
  }

  return 'Encrypted message could not be opened.'
}

export function toPrivateChatMessage(
  message: PrivateMessageRecord,
  currentUserId: string,
  decryptionResult: PrivateChatDecryptionResult,
) {
  if (decryptionResult.status === 'decrypted') {
    return {
      id: toPrivateMessageId(message),
      chatId: message.chatId,
      senderUserId: message.senderUserId,
      direction:
        message.senderUserId === currentUserId
          ? ('sent' as const)
          : ('received' as const),
      text: decryptionResult.text,
      timestamp: message.timestamp,
      encryption: {
        mode: 'PRIVATE' as const,
        state: 'decrypted' as const,
      },
    }
  }

  return {
    id: toPrivateMessageId(message),
    chatId: message.chatId,
    senderUserId: message.senderUserId,
    direction:
      message.senderUserId === currentUserId
        ? ('sent' as const)
        : ('received' as const),
    text: getPrivateMessageFallbackText(decryptionResult),
    timestamp: message.timestamp,
    encryption: {
      mode: 'PRIVATE' as const,
      state: decryptionResult.status,
    },
  }
}

export function getPrivateChatPreviewText(preview: string | undefined) {
  return preview || 'Encrypted message'
}
