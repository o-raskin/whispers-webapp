import type {
  MessageRecord,
  PresenceEvent,
  TypingEvent,
} from '../shared/types/chat'

const READ_MARKERS_STORAGE_PREFIX = 'whispers-read-markers:'

export function appendLog(lines: string[], message: string) {
  const timestamp = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return [`[${timestamp}] ${message}`, ...lines]
}

export function isPresenceEvent(
  payload: unknown,
): payload is PresenceEvent {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'type' in payload &&
    (payload.type === 'presence' || payload.type === 'PRESENCE')
  )
}

export function isTypingEvent(
  payload: unknown,
): payload is TypingEvent {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'type' in payload &&
    (
      payload.type === 'typing:start' ||
      payload.type === 'typing:stop' ||
      payload.type === 'TYPING_START' ||
      payload.type === 'TYPING_END'
    )
  )
}

export function hasTypedEventShape(
  payload: unknown,
): payload is Record<'type', unknown> {
  return typeof payload === 'object' && payload !== null && 'type' in payload
}

export function isMessageRecord(payload: unknown): payload is MessageRecord {
  if (typeof payload !== 'object' || payload === null) {
    return false
  }

  const record = payload as {
    chatId?: unknown
    senderUserId?: unknown
    text?: unknown
    timestamp?: unknown
  }

  return (
    typeof record.chatId === 'string' &&
    typeof record.senderUserId === 'string' &&
    typeof record.text === 'string' &&
    typeof record.timestamp === 'string'
  )
}

export function loadReadMarkers(userId: string): Record<string, string> {
  if (typeof window === 'undefined' || !userId) {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(`${READ_MARKERS_STORAGE_PREFIX}${userId}`)

    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as Record<string, string>
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export function saveReadMarkers(userId: string, markers: Record<string, string>) {
  if (typeof window === 'undefined' || !userId) {
    return
  }

  try {
    window.localStorage.setItem(
      `${READ_MARKERS_STORAGE_PREFIX}${userId}`,
      JSON.stringify(markers),
    )
  } catch {
    // Ignore storage write failures and keep the app functional.
  }
}

export function countUnreadMessages(
  messages: Array<Pick<MessageRecord, 'senderUserId' | 'timestamp'>>,
  currentUserId: string,
  readMarker: string | undefined,
): number {
  return messages.filter((message) => {
    if (message.senderUserId === currentUserId) {
      return false
    }

    if (!readMarker) {
      return true
    }

    return message.timestamp.localeCompare(readMarker) > 0
  }).length
}
