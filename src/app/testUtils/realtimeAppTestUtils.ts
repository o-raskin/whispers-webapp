import { act } from '@testing-library/react'
import { vi } from 'vitest'

export class MockWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: MockWebSocket[] = []

  readonly url: string
  readonly protocols?: string | string[]
  readyState = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  send = vi.fn()

  constructor(url: string, protocols?: string | string[]) {
    this.url = url
    this.protocols = protocols
    MockWebSocket.instances.push(this)
  }

  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  })

  emitOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  emitMessage(data: string) {
    this.onmessage?.({ data })
  }

  emitError() {
    this.onerror?.()
  }
}

export class MockMediaStreamTrack {
  readonly id: string

  constructor(id: string) {
    this.id = id
  }

  stop() {}
}

export class MockMediaStream {
  private readonly tracks: MockMediaStreamTrack[]

  constructor(tracks: MockMediaStreamTrack[] = [new MockMediaStreamTrack('track-1')]) {
    this.tracks = tracks
  }

  getTracks() {
    return this.tracks
  }

  addTrack(track: MockMediaStreamTrack) {
    this.tracks.push(track)
  }
}

export class MockRTCPeerConnection {
  static instances: MockRTCPeerConnection[] = []

  readonly config?: RTCConfiguration
  connectionState: RTCPeerConnectionState = 'new'
  localDescription: RTCSessionDescriptionInit | null = null
  remoteDescription: RTCSessionDescriptionInit | null = null
  onicecandidate:
    | ((event: { candidate: { toJSON: () => RTCIceCandidateInit } | null }) => void)
    | null = null
  ontrack:
    | ((event: { streams: MockMediaStream[]; track: MockMediaStreamTrack }) => void)
    | null = null
  onconnectionstatechange: (() => void) | null = null
  private readonly senders: Array<{ track: MockMediaStreamTrack | null }> = []

  constructor(config?: RTCConfiguration) {
    this.config = config
    MockRTCPeerConnection.instances.push(this)
  }

  getSenders() {
    return this.senders
  }

  addTrack(track: MockMediaStreamTrack, _stream: MockMediaStream) {
    void _stream
    this.senders.push({ track })
    return { track }
  }

  async createOffer() {
    return {
      type: 'offer' as const,
      sdp: 'mock-offer-sdp',
    }
  }

  async createAnswer() {
    return {
      type: 'answer' as const,
      sdp: 'mock-answer-sdp',
    }
  }

  async setLocalDescription(description: RTCSessionDescriptionInit) {
    this.localDescription = description
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    this.remoteDescription = description
  }

  async addIceCandidate(_candidate: RTCIceCandidateInit) {
    void _candidate
  }

  close() {
    this.connectionState = 'closed'
  }

  emitConnectionState(state: RTCPeerConnectionState) {
    this.connectionState = state
    this.onconnectionstatechange?.()
  }

  emitTrack(stream = new MockMediaStream()) {
    this.ontrack?.({
      streams: [stream],
      track: stream.getTracks()[0],
    })
  }

  emitIceCandidate(candidate: RTCIceCandidateInit) {
    this.onicecandidate?.({
      candidate: {
        toJSON: () => candidate,
      },
    })
  }
}

export function createDeferredPromise<T>() {
  let resolvePromise!: (value: T | PromiseLike<T>) => void
  let rejectPromise!: (reason?: unknown) => void

  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  }
}

interface InstallRealtimeAppBrowserMocksOptions {
  getUserMedia?: () => Promise<MockMediaStream>
  isSecureContext?: boolean
  randomUUID?: () => string
}

export function installRealtimeAppBrowserMocks(
  options: InstallRealtimeAppBrowserMocksOptions = {},
) {
  MockWebSocket.instances = []
  MockRTCPeerConnection.instances = []

  vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket)
  vi.stubGlobal(
    'RTCPeerConnection',
    MockRTCPeerConnection as unknown as typeof RTCPeerConnection,
  )
  vi.stubGlobal('MediaStream', MockMediaStream as unknown as typeof MediaStream)
  vi.stubGlobal('crypto', {
    randomUUID: options.randomUUID ?? (() => 'call-1'),
  } as unknown as Crypto)

  Object.defineProperty(window, 'isSecureContext', {
    configurable: true,
    value: options.isSecureContext ?? true,
  })

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia:
        options.getUserMedia ?? vi.fn(async () => new MockMediaStream()),
    },
  })
}

export function resetRealtimeAppBrowserMocks() {
  MockWebSocket.instances = []
  MockRTCPeerConnection.instances = []
  vi.unstubAllGlobals()
}

export function getLatestMockWebSocket() {
  const socket = MockWebSocket.instances.at(-1)

  if (!socket) {
    throw new Error('Expected a WebSocket to have been created.')
  }

  return socket
}

export async function emitSocketOpen(socket = getLatestMockWebSocket()) {
  await act(async () => {
    socket.emitOpen()
  })
}

export function setSecureContext(value: boolean) {
  Object.defineProperty(window, 'isSecureContext', {
    configurable: true,
    value,
  })
}
