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
  chatId: string
  senderUserId: string
  text: string
  timestamp: string
}

export interface ChatSummary {
  chatId: string
  username: string
  preview?: string
  unreadCount?: number
}

export interface ChatThread {
  chatId: string
  participant: string
  messages: ChatMessage[]
}

export interface SendMessageCommand {
  chatId: string
  text: string
}

export interface PresenceEvent {
  type: 'presence'
  username: string
  lastPingTime: string | null
}

export interface ErrorResponse {
  error: string
}
