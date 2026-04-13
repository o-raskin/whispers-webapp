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
