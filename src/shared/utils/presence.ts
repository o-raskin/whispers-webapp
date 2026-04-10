import { PRESENCE_TIMEOUT_MS } from '../config/backend'
import type { UserPresence } from '../types/chat'

export function parsePresenceDate(value: string | null): Date | null {
  if (!value) {
    return null
  }

  const normalized = value.endsWith('Z') ? value.slice(0, -1) : value
  const [datePart, timePart] = normalized.split('T')

  if (!datePart || !timePart) {
    const fallback = new Date(normalized)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }

  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute, second] = timePart.split(':').map(Number)
  const parsed = new Date(year, month - 1, day, hour, minute, second || 0)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function isUserOnline(user: UserPresence | null | undefined): boolean {
  if (!user) {
    return false
  }

  if (user.lastPingReceivedAt) {
    return Date.now() - user.lastPingReceivedAt <= PRESENCE_TIMEOUT_MS
  }

  const parsed = parsePresenceDate(user.lastPingTime)
  return parsed ? Date.now() - parsed.getTime() <= PRESENCE_TIMEOUT_MS : false
}

export function formatPresenceLabel(value: string | null): string {
  const parsed = parsePresenceDate(value)

  if (!parsed) {
    return value ?? 'n/a'
  }

  return parsed.toLocaleString()
}

export function formatTimestamp(value: string): string {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}
