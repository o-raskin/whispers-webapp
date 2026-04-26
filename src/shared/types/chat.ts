export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'
export type ChatType = 'DIRECT' | 'GROUP' | 'PRIVATE'
export type PrivateChatProtocolVersion = 'v1'
export type PrivateChatEncryptionAlgorithm = 'AES-GCM'
export type PrivateChatKeyWrapAlgorithm = 'RSA-OAEP'
export type PrivateChatKeyFormat = 'spki'
export type PrivateChatKeyStatus = 'ACTIVE' | 'REPLACED' | 'REVOKED'

export interface UserPresence {
  username: string
  lastPingTime: string | null
  lastPingReceivedAt?: number | null
}

export interface ChatMessage {
  id: string
  messageId?: string
  chatId: string
  senderUserId: string
  direction: 'sent' | 'received' | 'system'
  text: string
  timestamp: string
  updatedAt?: string | null
  encryption?: {
    mode: 'PRIVATE'
    state: 'decrypted' | 'error' | 'missing-key'
  }
}

export interface MessageRecord {
  type?: 'MESSAGE' | 'message'
  messageId?: string
  chatId: string
  senderUserId: string
  text: string
  timestamp: string
  updatedAt?: string | null
}

export interface EncryptedPrivateMessagePayload {
  protocolVersion: PrivateChatProtocolVersion
  encryptionAlgorithm: PrivateChatEncryptionAlgorithm
  keyWrapAlgorithm: PrivateChatKeyWrapAlgorithm
  ciphertext: string
  nonce: string
  senderKeyId: string
  senderMessageKeyEnvelope: string
  recipientKeyId: string
  recipientMessageKeyEnvelope: string
}

export interface PrivateMessageRecord {
  type?: 'PRIVATE_MESSAGE' | 'private_message'
  chatId: string
  senderUserId: string
  chatType: 'PRIVATE'
  encryptedMessage: EncryptedPrivateMessagePayload
  timestamp: string
}

export interface ChatSummary {
  chatId: string
  username: string
  type?: ChatType
  creatorUserId?: string | null
  firstName?: string | null
  lastName?: string | null
  profileUrl?: string | null
  preview?: string
  lastMessageTimestamp?: string
  unreadCount?: number
}

export interface UserProfile {
  userId: string
  username: string
  firstName?: string | null
  lastName?: string | null
  profileUrl?: string | null
  provider?: string | null
}

export interface ChatThread {
  chatId: string
  participant: string
  messages: ChatMessage[]
}

export type CallSignalKind = 'offer' | 'answer' | 'ice-candidate' | 'reject' | 'end'
export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active'
export type CallDirection = 'incoming' | 'outgoing'

interface BaseCallSignalPayload {
  version: 1
  chatId: string
  callId: string
  kind: CallSignalKind
}

export interface CallOfferSignal extends BaseCallSignalPayload {
  kind: 'offer'
  sdp: string
}

export interface CallAnswerSignal extends BaseCallSignalPayload {
  kind: 'answer'
  sdp: string
}

export interface CallIceCandidateSignal extends BaseCallSignalPayload {
  kind: 'ice-candidate'
  candidate: RTCIceCandidateInit
}

export interface CallRejectSignal extends BaseCallSignalPayload {
  kind: 'reject'
  reason?: string
}

export interface CallEndSignal extends BaseCallSignalPayload {
  kind: 'end'
}

export type CallSignalPayload =
  | CallOfferSignal
  | CallAnswerSignal
  | CallIceCandidateSignal
  | CallRejectSignal
  | CallEndSignal

export interface ActiveCallState {
  chatId: string
  callId: string
  participant: string
  direction: CallDirection
  phase: Exclude<CallPhase, 'idle'>
}

export interface SendMessageCommand {
  type: 'MESSAGE'
  chatId: string
  text: string
}

export interface SendPrivateMessageCommand {
  type: 'PRIVATE_MESSAGE'
  chatId: string
  privateMessage: EncryptedPrivateMessagePayload
}

export type PingCommandType = 'PRESENCE'

export interface PingCommand {
  type: PingCommandType
}

export type TypingCommandType = 'TYPING_START' | 'TYPING_END'
export type TypingEventType = 'typing:start' | 'typing:stop' | 'TYPING_START' | 'TYPING_END'

export interface TypingStartCommand {
  type: 'TYPING_START'
  chatId: string
}

export interface TypingStopCommand {
  type: 'TYPING_END'
  chatId: string
}

export type TypingCommand = TypingStartCommand | TypingStopCommand
export type WebSocketOutgoingCommand =
  | SendMessageCommand
  | SendPrivateMessageCommand
  | PingCommand
  | TypingCommand

export interface PrivateChatKeyRegistration {
  keyId: string
  publicKey: string
  algorithm: PrivateChatKeyWrapAlgorithm
  format: PrivateChatKeyFormat
}

export interface PrivateChatKeyView extends PrivateChatKeyRegistration {
  status: PrivateChatKeyStatus
  createdAt: string
  updatedAt: string
}

export interface PrivateChatView {
  chatId: string
  username: string
  type: 'PRIVATE'
  currentUserKey: PrivateChatKeyView
  counterpartKey: PrivateChatKeyView
}

export interface PresenceEvent {
  type: 'presence' | 'PRESENCE'
  username: string
  lastPingTime: string | null
}

export interface TypingEvent {
  type: TypingEventType
  chatId: string
  username?: string
}

export interface MessageDeleteEvent {
  type: 'MESSAGE_DELETE'
  chatId: string
  messageId: string
}

export interface MessageEditEvent {
  type: 'MESSAGE_EDIT'
  message: MessageRecord
}

export interface ChatDeleteEvent {
  type: 'CHAT_DELETE'
  chatId: string
}

export type WebSocketIncomingEvent =
  | MessageRecord
  | PrivateMessageRecord
  | PresenceEvent
  | TypingEvent
  | MessageDeleteEvent
  | MessageEditEvent
  | ChatDeleteEvent

export interface ErrorResponse {
  error: string
}
