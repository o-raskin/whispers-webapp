export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'

export interface UserPresence {
  username: string
  lastPingTime: string | null
  lastPingReceivedAt?: number | null
}

export interface ChatMessage {
  id: string
  chatId: string
  senderUserId: string
  direction: 'sent' | 'received' | 'system'
  text: string
  timestamp: string
}

export interface MessageRecord {
  type?: 'MESSAGE' | 'message'
  chatId: string
  senderUserId: string
  text: string
  timestamp: string
}

export interface ChatSummary {
  chatId: string
  username: string
  preview?: string
  lastMessageTimestamp?: string
  unreadCount?: number
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
export type WebSocketOutgoingCommand = SendMessageCommand | PingCommand | TypingCommand

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

export type WebSocketIncomingEvent = MessageRecord | PresenceEvent | TypingEvent

export interface ErrorResponse {
  error: string
}
