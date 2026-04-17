import type { MessageRecord } from '../../shared/types/chat'

const READ_MARKERS_STORAGE_PREFIX = 'whispers-read-markers:'

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
