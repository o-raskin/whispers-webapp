function getDefaultWebSocketUrl() {
  if (typeof window === 'undefined') {
    return 'ws://localhost/ws/user'
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws/user`
}

function parseConfiguredIceUrls(rawValue: string | undefined) {
  return rawValue
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean) ?? []
}

function getDefaultWebRtcHostname() {
  try {
    const webSocketUrl = new URL(getDefaultWebSocketUrl().replace(/^ws/i, 'http'))
    return webSocketUrl.hostname || 'localhost'
  } catch {
    return 'localhost'
  }
}

function toIceServerUrls(urls: string[]) {
  return urls.length === 1 ? urls[0] : urls
}

// Mirrors the defaults documented in the repo root swagger.yaml.
export const DEFAULT_WS_URL = getDefaultWebSocketUrl()
export const PRESENCE_TIMEOUT_MS = 30_000
export const PRESENCE_PING_INTERVAL_MS = 10_000

// Local coturn defaults remain available for FE-only development, but they now follow
// the current app hostname instead of a hard-coded private LAN address.
export const DEFAULT_TURN_USERNAME = 'test'
export const DEFAULT_TURN_CREDENTIAL = 'test123'

export function getWebRtcIceServers(): RTCIceServer[] {
  const hostname = getDefaultWebRtcHostname()
  const configuredStunUrls = parseConfiguredIceUrls(import.meta.env.VITE_WEBRTC_STUN_URLS)
  const configuredTurnUrls = parseConfiguredIceUrls(import.meta.env.VITE_WEBRTC_TURN_URLS)
  const turnUsername =
    import.meta.env.VITE_WEBRTC_TURN_USERNAME?.trim() || DEFAULT_TURN_USERNAME
  const turnCredential =
    import.meta.env.VITE_WEBRTC_TURN_CREDENTIAL?.trim() || DEFAULT_TURN_CREDENTIAL

  const iceServers: RTCIceServer[] = [
    {
      urls: toIceServerUrls(
        configuredStunUrls.length > 0 ? configuredStunUrls : [`stun:${hostname}:3478`],
      ),
    },
  ]

  const turnUrls =
    configuredTurnUrls.length > 0
      ? configuredTurnUrls
      : [
          `turn:${hostname}:3478?transport=udp`,
          `turn:${hostname}:3478?transport=tcp`,
        ]

  iceServers.push({
    urls: toIceServerUrls(turnUrls),
    username: turnUsername,
    credential: turnCredential,
  })

  return iceServers
}

export function getWebRtcPeerConnectionConfig(): RTCConfiguration {
  return {
    iceServers: getWebRtcIceServers(),
  }
}
