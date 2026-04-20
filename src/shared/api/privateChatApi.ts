import type {
  ChatSummary,
  EncryptedPrivateMessagePayload,
  PrivateChatKeyRegistration,
  PrivateChatKeyView,
  PrivateChatView,
  PrivateMessageRecord,
} from '../types/chat'
import {
  buildJsonHeaders,
  buildUrl,
  parseJsonResponse,
} from './apiClient'
import { ApiError } from './apiClient'

interface ChatSummaryResponse {
  chatId: number
  username: string
  type?: ChatSummary['type']
  firstName?: string | null
  lastName?: string | null
  profileUrl?: string | null
}

interface PrivateChatKeyViewResponse extends PrivateChatKeyRegistration {
  status: PrivateChatKeyView['status']
  createdAt: string
  updatedAt: string
}

interface PrivateChatViewResponse {
  chatId: number
  username: string
  type: 'PRIVATE'
  currentUserKey: PrivateChatKeyViewResponse
  counterpartKey: PrivateChatKeyViewResponse
}

interface PrivateMessageViewResponse {
  chatId: number
  senderUsername: string
  chatType: 'PRIVATE'
  encryptedMessage: EncryptedPrivateMessagePayload
  timestamp: string
}

interface PrivateChatKeyRegistrationAttempt {
  keyId: string
  publicKey: string
  algorithm: string
  format: string
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

function normalizePrivateChatKeyView(key: PrivateChatKeyViewResponse): PrivateChatKeyView {
  return {
    keyId: key.keyId,
    publicKey: key.publicKey,
    algorithm: key.algorithm,
    format: key.format,
    status: key.status,
    createdAt: key.createdAt,
    updatedAt: key.updatedAt,
  }
}

function normalizePrivateChatView(chat: PrivateChatViewResponse): PrivateChatView {
  return {
    chatId: String(chat.chatId),
    username: chat.username,
    type: 'PRIVATE',
    currentUserKey: normalizePrivateChatKeyView(chat.currentUserKey),
    counterpartKey: normalizePrivateChatKeyView(chat.counterpartKey),
  }
}

function normalizePrivateMessageRecord(
  message: PrivateMessageViewResponse,
): PrivateMessageRecord {
  return {
    chatId: String(message.chatId),
    senderUserId: message.senderUsername,
    chatType: 'PRIVATE',
    encryptedMessage: message.encryptedMessage,
    timestamp: message.timestamp,
  }
}

function toPemPublicKey(publicKeyBase64: string) {
  const wrapped = publicKeyBase64.match(/.{1,64}/g)?.join('\n') ?? publicKeyBase64

  return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----`
}

function buildPrivateKeyRegistrationAttempts(request: PrivateChatKeyRegistration) {
  const attempts: PrivateChatKeyRegistrationAttempt[] = [
    request,
    {
      ...request,
      format: 'SPKI',
    },
    {
      ...request,
      publicKey: toPemPublicKey(request.publicKey),
    },
    {
      ...request,
      publicKey: toPemPublicKey(request.publicKey),
      format: 'SPKI',
    },
  ]

  const seenPayloads = new Set<string>()

  return attempts.filter((attempt) => {
    const signature = JSON.stringify(attempt)

    if (seenPayloads.has(signature)) {
      return false
    }

    seenPayloads.add(signature)
    return true
  })
}

export async function registerPrivateChatKey(
  serverUrl: string,
  accessToken: string,
  request: PrivateChatKeyRegistration,
): Promise<PrivateChatKeyView> {
  const attempts = buildPrivateKeyRegistrationAttempts(request)
  let lastError: ApiError | null = null

  for (const attempt of attempts) {
    try {
      const response = await fetch(buildUrl(serverUrl, '/public-keys'), {
        method: 'POST',
        headers: buildJsonHeaders(accessToken, {
          contentType: 'application/json',
        }),
        body: JSON.stringify(attempt),
      })

      const payload = await parseJsonResponse<PrivateChatKeyViewResponse>(
        response,
        'Could not register the browser key.',
      )

      return normalizePrivateChatKeyView(payload)
    } catch (error) {
      if (!(error instanceof ApiError)) {
        throw error
      }

      lastError = error

      if (error.status === 401 || error.status === 409) {
        throw error
      }
    }
  }

  throw lastError ?? new ApiError('Could not register the browser key.', 500)
}

export async function createPrivateChat(
  serverUrl: string,
  accessToken: string,
  targetUserId: string,
  keyId: string,
): Promise<ChatSummary> {
  const response = await fetch(
    buildUrl(serverUrl, '/private-chats', {
      targetUserId,
      keyId,
    }),
    {
      method: 'POST',
      headers: buildJsonHeaders(accessToken),
    },
  )

  const payload = await parseJsonResponse<ChatSummaryResponse>(
    response,
    'Create private chat failed.',
  )

  return normalizeChatSummary(payload)
}

export async function fetchPrivateChat(
  serverUrl: string,
  accessToken: string,
  chatId: string,
  keyId: string,
): Promise<PrivateChatView> {
  const response = await fetch(
    buildUrl(serverUrl, `/private-chats/${encodeURIComponent(chatId)}`, {
      keyId,
    }),
    {
      headers: buildJsonHeaders(accessToken),
    },
  )

  const payload = await parseJsonResponse<PrivateChatViewResponse>(
    response,
    'Cannot load private chat details.',
  )

  return normalizePrivateChatView(payload)
}

export async function fetchPrivateMessages(
  serverUrl: string,
  accessToken: string,
  chatId: string,
  keyId: string,
): Promise<PrivateMessageRecord[]> {
  const response = await fetch(
    buildUrl(serverUrl, `/private-chats/${encodeURIComponent(chatId)}/messages`, {
      keyId,
    }),
    {
      headers: buildJsonHeaders(accessToken),
    },
  )

  const payload = await parseJsonResponse<PrivateMessageViewResponse[]>(
    response,
    'Cannot load private history.',
  )

  return payload.map(normalizePrivateMessageRecord)
}
