export function createCallId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `call-${Date.now()}`
}

export function getAudioInputAvailabilityError() {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Audio calling requires HTTPS or localhost. Open the app over a secure origin and try again.'
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    return 'Audio calling is unavailable because this page does not have access to media devices.'
  }

  if (typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return 'Audio calling is not supported in this browser.'
  }

  return null
}

export function toAudioStreamErrorMessage(error: unknown) {
  if (!(error instanceof DOMException)) {
    return null
  }

  switch (error.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone access was blocked. Allow microphone access and try again.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No microphone was found on this device.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Your microphone is busy or unavailable right now.'
    case 'OverconstrainedError':
      return 'No compatible microphone input is available.'
    default:
      return null
  }
}

export function buildCleanupStackTrace() {
  try {
    throw new Error('WebRTC cleanup trace')
  } catch (error) {
    return error instanceof Error ? error.stack ?? 'stack unavailable' : 'stack unavailable'
  }
}
