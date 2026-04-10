import type {
  ChatMessage,
  ChatSummary,
  ErrorResponse,
  UserPresence,
} from '../types/chat'

function getHttpBaseUrl(serverUrl: string): string {
  const wsUrl = new URL(serverUrl)
  const protocol = wsUrl.protocol === 'wss:' ? 'https:' : 'http:'

  return `${protocol}//${wsUrl.host}`
}

function buildUrl(serverUrl: string, path: string, params: Record<string, string>) {
  const url = new URL(path, getHttpBaseUrl(serverUrl))

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  return url.toString()
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | ErrorResponse | null

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? payload.error
        : fallbackMessage
    throw new Error(message)
  }

  return payload as T
}

export function buildWebSocketUrl(serverUrl: string, userId: string): string {
  const url = new URL(serverUrl)
  url.searchParams.set('userId', userId)
  return url.toString()
}

export async function fetchChats(serverUrl: string, userId: string): Promise<ChatSummary[]> {
  const response = await fetch(buildUrl(serverUrl, '/chats', { userId }))
  return parseJsonResponse<ChatSummary[]>(response, 'Cannot load chats.')
}

export async function createChat(
  serverUrl: string,
  userId: string,
  targetUserId: string,
): Promise<ChatSummary> {
  const response = await fetch(
    buildUrl(serverUrl, '/chats', {
      userId,
      targetUserId,
    }),
    {
      method: 'POST',
    },
  )

  return parseJsonResponse<ChatSummary>(response, 'Create chat failed.')
}

export async function fetchMessages(
  serverUrl: string,
  userId: string,
  chatId: string,
): Promise<ChatMessage[]> {
  const response = await fetch(
    buildUrl(serverUrl, '/messages', {
      userId,
      chatId,
    }),
  )

  const messages = await parseJsonResponse<
    Array<{
      chatId: string
      senderUserId: string
      text: string
      timestamp: string
    }>
  >(response, 'Cannot load history.')

  return messages.map((message) => ({
    id: `${message.chatId}-${message.senderUserId}-${message.timestamp}-${message.text}`,
    chatId: message.chatId,
    senderUserId: message.senderUserId,
    text: message.text,
    timestamp: message.timestamp,
    direction: 'received',
  }))
}

export async function fetchUsers(serverUrl: string, userId: string): Promise<UserPresence[]> {
  const response = await fetch(buildUrl(serverUrl, '/users', { userId }))
  return parseJsonResponse<UserPresence[]>(response, 'Cannot load users.')
}

export async function sendPresencePing(serverUrl: string, userId: string): Promise<void> {
  const response = await fetch(buildUrl(serverUrl, '/ping', { userId }), {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error('Cannot send ping.')
  }
}
