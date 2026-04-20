import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import './testUtils/realtimeAppModuleMocks'
import { App } from './App'
import { getWebRtcPeerConnectionConfig } from '../shared/config/backend'
import { buildCallSignalText, parseCallSignalText } from '../shared/utils/callSignals'
import { apiMocks } from './testUtils/realtimeAppModuleMocks'
import {
  connectAuthenticatedWorkspace,
  mockDirectChatBootstrap,
  setupRealtimeAppTestEnvironment,
  teardownRealtimeAppTestEnvironment,
} from './testUtils/realtimeAppTestSetup'
import {
  createDeferredPromise,
  emitSocketOpen,
  MockMediaStream,
  MockRTCPeerConnection,
  installRealtimeAppBrowserMocks,
  setSecureContext,
} from './testUtils/realtimeAppTestUtils'

describe('App calling flows', () => {
  beforeEach(() => {
    setupRealtimeAppTestEnvironment()
  })

  afterEach(() => {
    teardownRealtimeAppTestEnvironment()
  })

  test('starts an audio call by sending a hidden offer signal', async () => {
    const user = userEvent.setup()

    mockDirectChatBootstrap('Ready for a call')

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

    await waitFor(() => {
      expect(screen.getByText('chat:bob:1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'chat:bob:1' }))

    await waitFor(() => {
      expect(screen.getByTestId('participant')).toHaveTextContent('bob')
    })

    await user.click(screen.getByRole('button', { name: 'start audio call' }))

    await waitFor(() => {
      expect(screen.getByTestId('call-phase')).toHaveTextContent('outgoing')
      expect(screen.getByTestId('local-stream')).toHaveTextContent('yes')
    })

    expect(MockRTCPeerConnection.instances[0]?.config).toEqual(
      getWebRtcPeerConnectionConfig(),
    )
    expect(MockRTCPeerConnection.instances[0]?.config).not.toHaveProperty('iceTransportPolicy')

    const offerPayload = apiMocks.mockSendWebSocketCommand.mock.calls
      .map(([, payload]) => payload)
      .find(
        (payload): payload is { type: string; chatId: string; text: string } =>
          typeof payload === 'object' &&
          payload !== null &&
          'type' in payload &&
          payload.type === 'MESSAGE' &&
          'chatId' in payload &&
          typeof payload.chatId === 'string' &&
          'text' in payload &&
          typeof payload.text === 'string' &&
          parseCallSignalText(payload.text)?.kind === 'offer',
      )

    expect(offerPayload).toEqual(
      expect.objectContaining({
        type: 'MESSAGE',
        chatId: 'chat-1',
      }),
    )
    expect(parseCallSignalText(String(offerPayload?.text))).toEqual(
      expect.objectContaining({
        version: 1,
        kind: 'offer',
        chatId: 'chat-1',
        callId: 'call-1',
        sdp: 'mock-offer-sdp',
      }),
    )
  })

  test('creates only one peer connection when call start is triggered twice during media setup', async () => {
    const user = userEvent.setup()
    const deferredStream = createDeferredPromise<MockMediaStream>()
    const getUserMediaMock = vi.fn(() => deferredStream.promise)

    installRealtimeAppBrowserMocks({
      getUserMedia: getUserMediaMock,
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('call-1')
        .mockReturnValueOnce('call-2'),
    })

    mockDirectChatBootstrap('Ready for a call')

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

    await waitFor(() => {
      expect(screen.getByText('chat:bob:1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'chat:bob:1' }))

    await waitFor(() => {
      expect(screen.getByTestId('participant')).toHaveTextContent('bob')
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'start audio call' }))
      fireEvent.click(screen.getByRole('button', { name: 'start audio call' }))
    })

    expect(getUserMediaMock).toHaveBeenCalledTimes(1)
    expect(MockRTCPeerConnection.instances).toHaveLength(0)

    await act(async () => {
      deferredStream.resolve(new MockMediaStream())
      await deferredStream.promise
    })

    await waitFor(() => {
      expect(MockRTCPeerConnection.instances).toHaveLength(1)
      expect(screen.getByTestId('call-phase')).toHaveTextContent('outgoing')
    })

    const offerSignals = apiMocks.mockSendWebSocketCommand.mock.calls
      .map(([, payload]) => payload)
      .filter(
        (payload): payload is { type: string; chatId: string; text: string } =>
          typeof payload === 'object' &&
          payload !== null &&
          'type' in payload &&
          payload.type === 'MESSAGE' &&
          'chatId' in payload &&
          typeof payload.chatId === 'string' &&
          'text' in payload &&
          typeof payload.text === 'string' &&
          parseCallSignalText(payload.text)?.kind === 'offer',
      )

    expect(offerSignals).toHaveLength(1)
    expect(parseCallSignalText(offerSignals[0].text)).toEqual(
      expect.objectContaining({
        callId: 'call-1',
      }),
    )
  })

  test('shows a secure-origin error when audio call is started from an insecure page', async () => {
    const user = userEvent.setup()

    mockDirectChatBootstrap('Ready for a call')
    setSecureContext(false)

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

    await waitFor(() => {
      expect(screen.getByText('chat:bob:1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'chat:bob:1' }))

    await waitFor(() => {
      expect(screen.getByTestId('participant')).toHaveTextContent('bob')
    })

    await user.click(screen.getByRole('button', { name: 'start audio call' }))

    await waitFor(() => {
      expect(screen.getByTestId('call-phase')).toHaveTextContent('idle')
      expect(screen.getByTestId('event-log')).toHaveTextContent(
        'Audio calling requires HTTPS or localhost. Open the app over a secure origin and try again.',
      )
    })
  })

  test('keeps hidden call signaling out of chat history and unread state', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockResolvedValue([{ chatId: 'chat-1', username: 'bob' }])
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'bob', lastPingTime: null }])
    apiMocks.mockFetchMessages.mockResolvedValue([
      {
        chatId: 'chat-1',
        senderUserId: 'bob',
        text: 'Visible hello',
        timestamp: '2026-04-12T10:00:00Z',
      },
      {
        chatId: 'chat-1',
        senderUserId: 'bob',
        text: buildCallSignalText({
          version: 1,
          kind: 'offer',
          chatId: 'chat-1',
          callId: 'call-remote',
          sdp: 'remote-offer',
        }),
        timestamp: '2026-04-12T10:01:00Z',
      },
    ])

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

    await waitFor(() => {
      expect(screen.getByText('chat:bob:1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'chat:bob:1' }))

    await waitFor(() => {
      expect(screen.getByTestId('message-count')).toHaveTextContent('1')
      expect(screen.getByTestId('last-message')).toHaveTextContent('Visible hello')
    })

    await act(async () => {
      socket.emitMessage(
        JSON.stringify({
          type: 'MESSAGE',
          chatId: 'chat-1',
          senderUserId: 'bob',
          text: buildCallSignalText({
            version: 1,
            kind: 'offer',
            chatId: 'chat-1',
            callId: 'call-incoming',
            sdp: 'incoming-offer',
          }),
          timestamp: '2026-04-12T10:02:00Z',
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('call-phase')).toHaveTextContent('incoming')
      expect(screen.getByTestId('message-count')).toHaveTextContent('1')
      expect(screen.getByTestId('last-message')).toHaveTextContent('Visible hello')
    })
  })

  test('clears the active call state when the remote peer rejects the call', async () => {
    const user = userEvent.setup()

    mockDirectChatBootstrap()

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

    await waitFor(() => {
      expect(screen.getByText('chat:bob:1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'chat:bob:1' }))

    await waitFor(() => {
      expect(screen.getByTestId('participant')).toHaveTextContent('bob')
    })

    await user.click(screen.getByRole('button', { name: 'start audio call' }))

    await waitFor(() => {
      expect(screen.getByTestId('call-phase')).toHaveTextContent('outgoing')
    })

    await act(async () => {
      socket.emitMessage(
        JSON.stringify({
          type: 'MESSAGE',
          chatId: 'chat-1',
          senderUserId: 'bob',
          text: buildCallSignalText({
            version: 1,
            kind: 'reject',
            chatId: 'chat-1',
            callId: 'call-1',
            reason: 'busy',
          }),
          timestamp: '2026-04-12T10:03:00Z',
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('call-phase')).toHaveTextContent('idle')
      expect(screen.getByTestId('local-stream')).toHaveTextContent('no')
      expect(screen.getByTestId('remote-stream')).toHaveTextContent('no')
    })
  })

  test('clears the active call state when the remote peer ends the call', async () => {
    const user = userEvent.setup()

    mockDirectChatBootstrap()

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

    await waitFor(() => {
      expect(screen.getByText('chat:bob:1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'chat:bob:1' }))

    await waitFor(() => {
      expect(screen.getByTestId('participant')).toHaveTextContent('bob')
    })

    await user.click(screen.getByRole('button', { name: 'start audio call' }))

    await waitFor(() => {
      expect(screen.getByTestId('call-phase')).toHaveTextContent('outgoing')
    })

    await act(async () => {
      socket.emitMessage(
        JSON.stringify({
          type: 'MESSAGE',
          chatId: 'chat-1',
          senderUserId: 'bob',
          text: buildCallSignalText({
            version: 1,
            kind: 'end',
            chatId: 'chat-1',
            callId: 'call-1',
          }),
          timestamp: '2026-04-12T10:04:00Z',
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('call-phase')).toHaveTextContent('idle')
      expect(screen.getByTestId('local-stream')).toHaveTextContent('no')
      expect(screen.getByTestId('remote-stream')).toHaveTextContent('no')
    })
  })

  test('declines an incoming call from the currently open chat', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockResolvedValue([{ chatId: 'chat-1', username: 'bob' }])
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'bob', lastPingTime: null }])
    apiMocks.mockFetchMessages.mockResolvedValue([
      {
        chatId: 'chat-1',
        senderUserId: 'bob',
        text: 'Visible hello',
        timestamp: '2026-04-12T10:00:00Z',
      },
    ])

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

    await waitFor(() => {
      expect(screen.getByText('chat:bob:1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'chat:bob:1' }))

    await waitFor(() => {
      expect(screen.getByTestId('participant')).toHaveTextContent('bob')
      expect(screen.getByTestId('message-count')).toHaveTextContent('1')
    })

    await act(async () => {
      socket.emitMessage(
        JSON.stringify({
          type: 'MESSAGE',
          chatId: 'chat-1',
          senderUserId: 'bob',
          text: buildCallSignalText({
            version: 1,
            kind: 'offer',
            chatId: 'chat-1',
            callId: 'call-incoming',
            sdp: 'incoming-offer',
          }),
          timestamp: '2026-04-12T10:02:00Z',
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('call-phase')).toHaveTextContent('incoming')
      expect(screen.getByTestId('message-count')).toHaveTextContent('1')
    })

    await user.click(screen.getByRole('button', { name: 'decline audio call' }))

    const rejectPayload = apiMocks.mockSendWebSocketCommand.mock.calls
      .map(([, payload]) => payload)
      .find(
        (payload): payload is { type: string; chatId: string; text: string } =>
          typeof payload === 'object' &&
          payload !== null &&
          'type' in payload &&
          payload.type === 'MESSAGE' &&
          'chatId' in payload &&
          typeof payload.chatId === 'string' &&
          'text' in payload &&
          typeof payload.text === 'string' &&
          parseCallSignalText(payload.text)?.kind === 'reject',
      )

    await waitFor(() => {
      expect(screen.getByTestId('call-phase')).toHaveTextContent('idle')
      expect(screen.getByTestId('message-count')).toHaveTextContent('1')
      expect(screen.getByTestId('last-message')).toHaveTextContent('Visible hello')
    })

    expect(parseCallSignalText(String(rejectPayload?.text))).toEqual(
      expect.objectContaining({
        version: 1,
        kind: 'reject',
        chatId: 'chat-1',
        callId: 'call-incoming',
        reason: 'declined',
      }),
    )
  })
})
