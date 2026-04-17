import {
  DEFAULT_TURN_CREDENTIAL,
  DEFAULT_TURN_USERNAME,
  getWebRtcIceServers,
  getWebRtcPeerConnectionConfig,
} from './backend'

describe('backend config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('builds default WebRTC ICE servers from the current browser host', () => {
    expect(getWebRtcIceServers()).toEqual([
      { urls: 'stun:localhost:3478' },
      {
        urls: [
          'turn:localhost:3478?transport=udp',
          'turn:localhost:3478?transport=tcp',
        ],
        username: DEFAULT_TURN_USERNAME,
        credential: DEFAULT_TURN_CREDENTIAL,
      },
    ])
  })

  test('uses configured WebRTC ICE overrides when provided', () => {
    vi.stubEnv(
      'VITE_WEBRTC_STUN_URLS',
      'stun:stun-1.example.com:3478, stun:stun-2.example.com:3478',
    )
    vi.stubEnv(
      'VITE_WEBRTC_TURN_URLS',
      'turn:turn.example.com:3478?transport=udp, turn:turn.example.com:3478?transport=tcp',
    )
    vi.stubEnv('VITE_WEBRTC_TURN_USERNAME', 'demo-user')
    vi.stubEnv('VITE_WEBRTC_TURN_CREDENTIAL', 'demo-pass')

    expect(getWebRtcPeerConnectionConfig()).toEqual({
      iceServers: [
        {
          urls: [
            'stun:stun-1.example.com:3478',
            'stun:stun-2.example.com:3478',
          ],
        },
        {
          urls: [
            'turn:turn.example.com:3478?transport=udp',
            'turn:turn.example.com:3478?transport=tcp',
          ],
          username: 'demo-user',
          credential: 'demo-pass',
        },
      ],
    })
  })
})
