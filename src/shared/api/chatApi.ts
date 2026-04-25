import type {
  ChatType,
  ChatSummary,
  MessageRecord,
  UserProfile,
  UserPresence,
  WebSocketOutgoingCommand,
} from '../types/chat'
import {
  buildJsonHeaders,
  buildUrl,
  parseJsonResponse,
} from './apiClient'

interface ChatSummaryResponse {
  chatId: number
  username: string
  type?: ChatType
  firstName?: string | null
  lastName?: string | null
  profileUrl?: string | null
}

interface UserProfileResponse {
  userId: string
  username: string
  firstName?: string | null
  lastName?: string | null
  profileUrl?: string | null
  provider?: string | null
}

interface MessageRecordResponse {
  messageId?: number
  chatId: number
  senderUserId: string
  text: string
  timestamp: string
}

function normalizeChatSummary(chat: ChatSummaryResponse): ChatSummary {
  return {
    chatId: String(chat.chatId),
    username: chat.username,
    type: chat.type ?? 'DIRECT',
    firstName: chat.firstName ?? null,
    lastName: chat.lastName ?? null,
    profileUrl: chat.profileUrl ?? null,
  }
}

function normalizeUserProfile(profile: UserProfileResponse): UserProfile {
  return {
    userId: profile.userId,
    username: profile.username,
    firstName: profile.firstName ?? null,
    lastName: profile.lastName ?? null,
    profileUrl: profile.profileUrl ?? null,
    provider: profile.provider ?? null,
  }
}

function normalizeMessageRecord(message: MessageRecordResponse): MessageRecord {
  const { messageId, ...record } = message

  return {
    ...record,
    ...(typeof messageId === 'number' ? { messageId: String(messageId) } : {}),
    chatId: String(record.chatId),
  }
}

export function buildWebSocketUrl(serverUrl: string): string {
  return new URL(serverUrl).toString()
}

export function buildWebSocketProtocols(accessToken: string): string[] {
  return [`whispers.bearer.${accessToken}`]
}

function normalizeOutgoingCommand(payload: WebSocketOutgoingCommand): Record<string, unknown> {
  if (!('chatId' in payload)) {
    return payload as unknown as Record<string, unknown>
  }

  const normalizedChatId = Number(payload.chatId)

  if (!Number.isFinite(normalizedChatId)) {
    return payload as unknown as Record<string, unknown>
  }

  return {
    ...payload,
    chatId: normalizedChatId,
  }
}

export function sendWebSocketCommand(
  socket: WebSocket,
  payload: WebSocketOutgoingCommand,
): void {
  socket.send(JSON.stringify(normalizeOutgoingCommand(payload)))
}

export async function fetchChats(
  serverUrl: string,
  accessToken: string,
  keyId?: string | null,
): Promise<ChatSummary[]> {
  const response = await fetch(buildUrl(serverUrl, '/chats', {
    keyId: keyId?.trim() || undefined,
  }), {
    headers: buildJsonHeaders(accessToken),
  })

  const payload = await parseJsonResponse<ChatSummaryResponse[]>(response, 'Cannot load chats.')
  return payload.map(normalizeChatSummary)
}

export async function createChat(
  serverUrl: string,
  accessToken: string,
  targetUserId: string,
): Promise<ChatSummary> {
  const response = await fetch(
    buildUrl(serverUrl, '/chats', {
      targetUserId,
    }),
    {
      method: 'POST',
      headers: buildJsonHeaders(accessToken),
    },
  )

  const payload = await parseJsonResponse<ChatSummaryResponse>(response, 'Create chat failed.')
  return normalizeChatSummary(payload)
}

export async function fetchMessages(
  serverUrl: string,
  accessToken: string,
  chatId: string,
): Promise<MessageRecord[]> {
  const response = await fetch(
    buildUrl(serverUrl, '/messages', {
      chatId,
    }),
    {
      headers: buildJsonHeaders(accessToken),
    },
  )

  const payload = await parseJsonResponse<MessageRecordResponse[]>(response, 'Cannot load history.')
  return payload.map(normalizeMessageRecord)
}

export async function deleteMessage(
  serverUrl: string,
  accessToken: string,
  messageId: string,
): Promise<void> {
  const response = await fetch(
    buildUrl(serverUrl, `/messages/${encodeURIComponent(messageId)}`),
    {
      method: 'DELETE',
      headers: buildJsonHeaders(accessToken),
    },
  )

  if (response.ok) {
    return
  }

  await parseJsonResponse<never>(response, 'Delete message failed.')
}

export async function fetchUsers(serverUrl: string, accessToken: string): Promise<UserPresence[]> {
  const response = await fetch(buildUrl(serverUrl, '/users'), {
    headers: buildJsonHeaders(accessToken),
  })

  return parseJsonResponse<UserPresence[]>(response, 'Cannot load users.')
}

export async function fetchUserProfile(
  serverUrl: string,
  accessToken: string,
  userId: string,
): Promise<UserProfile> {
  const response = await fetch(
    buildUrl(serverUrl, `/users/${encodeURIComponent(userId)}`),
    {
      headers: buildJsonHeaders(accessToken),
    },
  )

  const payload = await parseJsonResponse<UserProfileResponse>(
    response,
    'Cannot load user profile.',
  )

  return normalizeUserProfile(payload)
}
