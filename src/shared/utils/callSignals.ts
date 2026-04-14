import type { CallSignalPayload } from '../types/chat'

export const CALL_SIGNAL_PREFIX = '__WHISPERS_CALL__:'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isRtcIceCandidateInit(value: unknown): value is RTCIceCandidateInit {
  if (!isRecord(value)) {
    return false
  }

  if ('candidate' in value && value.candidate !== null && typeof value.candidate !== 'string') {
    return false
  }

  if ('sdpMid' in value && value.sdpMid !== null && typeof value.sdpMid !== 'string') {
    return false
  }

  if (
    'sdpMLineIndex' in value &&
    value.sdpMLineIndex !== null &&
    typeof value.sdpMLineIndex !== 'number'
  ) {
    return false
  }

  if (
    'usernameFragment' in value &&
    value.usernameFragment !== null &&
    typeof value.usernameFragment !== 'string'
  ) {
    return false
  }

  return true
}

export function isCallSignalText(text: string): boolean {
  return text.startsWith(CALL_SIGNAL_PREFIX)
}

export function buildCallSignalText(payload: CallSignalPayload): string {
  return `${CALL_SIGNAL_PREFIX}${JSON.stringify(payload)}`
}

export function parseCallSignalText(text: string): CallSignalPayload | null {
  if (!isCallSignalText(text)) {
    return null
  }

  const rawPayload = text.slice(CALL_SIGNAL_PREFIX.length)

  try {
    const payload = JSON.parse(rawPayload) as unknown

    if (!isRecord(payload)) {
      return null
    }

    if (payload.version !== 1) {
      return null
    }

    if (typeof payload.chatId !== 'string' || typeof payload.callId !== 'string') {
      return null
    }

    switch (payload.kind) {
      case 'offer':
      case 'answer':
        return typeof payload.sdp === 'string'
          ? (payload as unknown as CallSignalPayload)
          : null
      case 'ice-candidate':
        return isRtcIceCandidateInit(payload.candidate)
          ? (payload as unknown as CallSignalPayload)
          : null
      case 'reject':
        return !('reason' in payload) || typeof payload.reason === 'string'
          ? (payload as unknown as CallSignalPayload)
          : null
      case 'end':
        return payload as unknown as CallSignalPayload
      default:
        return null
    }
  } catch {
    return null
  }
}
