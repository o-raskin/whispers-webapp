function getDefaultWebSocketUrl() {
  if (typeof window === 'undefined') {
    return 'ws://localhost/ws/user'
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws/user`
}

// Mirrors the defaults documented in the repo root swagger.yaml.
export const DEFAULT_WS_URL = getDefaultWebSocketUrl()
export const PRESENCE_TIMEOUT_MS = 30_000
export const PRESENCE_PING_INTERVAL_MS = 10_000

// Temporary local coturn defaults for the FE-only WebRTC prototype.
// Replace these with your local coturn credentials when needed.
export const DEFAULT_TURN_USERNAME = 'test'
export const DEFAULT_TURN_CREDENTIAL = 'test123'

export const DEFAULT_WEBRTC_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:192.168.0.12:3478' },
  {
    urls: [
      'turn:192.168.0.12:3478?transport=udp',
      // 'turn:192.168.0.10:3478?transport=tcp',
    ],
    username: DEFAULT_TURN_USERNAME,
    credential: DEFAULT_TURN_CREDENTIAL,
  },
]
