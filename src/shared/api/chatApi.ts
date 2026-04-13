import type {
  ChatSummary,
  ErrorResponse,
  MessageRecord,
  UserPresence,
  WebSocketOutgoingCommand,
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

function buildJsonHeaders() {
  return {
    Accept: 'application/json',
  }
}

export function buildWebSocketUrl(serverUrl: string, userId: string): string {
  const url = new URL(serverUrl)
  url.searchParams.set('userId', userId)
  return url.toString()
}

export function sendWebSocketCommand(
  socket: WebSocket,
  payload: WebSocketOutgoingCommand,
): void {
  socket.send(JSON.stringify(payload))
}

export async function fetchChats(serverUrl: string, userId: string): Promise<ChatSummary[]> {
  const response = await fetch(buildUrl(serverUrl, '/chats', { userId }), {
    headers: buildJsonHeaders(),
  })
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
      headers: buildJsonHeaders(),
    },
  )

  return parseJsonResponse<ChatSummary>(response, 'Create chat failed.')
}

export async function fetchMessages(
  serverUrl: string,
  userId: string,
  chatId: string,
): Promise<MessageRecord[]> {
  const response = await fetch(
    buildUrl(serverUrl, '/messages', {
      userId,
      chatId,
    }),
    {
      headers: buildJsonHeaders(),
    },
  )

  return parseJsonResponse<MessageRecord[]>(response, 'Cannot load history.')
}

export async function fetchUsers(serverUrl: string, userId: string): Promise<UserPresence[]> {
  const response = await fetch(buildUrl(serverUrl, '/users', { userId }), {
    headers: buildJsonHeaders(),
  })
  return parseJsonResponse<UserPresence[]>(response, 'Cannot load users.')
}
