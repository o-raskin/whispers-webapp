import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import './testUtils/realtimeAppModuleMocks'
import { App } from './App'
import { DEFAULT_WS_URL, PRESENCE_PING_INTERVAL_MS } from '../shared/config/backend'
import {
  apiMocks,
  authMocks,
  privateServiceMocks,
} from './testUtils/realtimeAppModuleMocks'
import {
  connectAuthenticatedWorkspace,
  setupRealtimeAppTestEnvironment,
  teardownRealtimeAppTestEnvironment,
} from './testUtils/realtimeAppTestSetup'
import { emitSocketOpen } from './testUtils/realtimeAppTestUtils'

describe('App workspace flows', () => {
  beforeEach(() => {
    setupRealtimeAppTestEnvironment()
  })

  afterEach(() => {
    teardownRealtimeAppTestEnvironment()
  })

  test('hides the welcome overlay after authentication even before websocket open', async () => {
    render(<App />)

    await connectAuthenticatedWorkspace()

    await waitFor(() => {
      expect(screen.queryByTestId('welcome')).not.toBeInTheDocument()
      expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    })
  })

  test('publishes the private browser key during authenticated bootstrap', async () => {
    render(<App />)

    await connectAuthenticatedWorkspace()

    await waitFor(() => {
      expect(
        privateServiceMocks.mockEnsureRegisteredPrivateChatBrowserIdentity,
      ).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
        'alice@example.com',
        ['user-1', 'alice'],
      )
    })
  })

  test('connects, bootstraps chats, loads history, and sends messages', async () => {
    const user = userEvent.setup()
    const setIntervalSpy = vi.spyOn(window, 'setInterval')

    apiMocks.mockFetchChats.mockResolvedValue([{ chatId: 'chat-1', username: 'bob' }])
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'bob', lastPingTime: null }])
    apiMocks.mockFetchMessages.mockResolvedValue([
      {
        chatId: 'chat-1',
        senderUserId: 'bob',
        text: 'Welcome back',
        timestamp: '2026-04-12T10:00:00Z',
      },
    ])

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    expect(socket.url).toBe(DEFAULT_WS_URL)
    expect(socket.protocols).toEqual(['whispers.bearer.access-token'])

    await emitSocketOpen(socket)

    await waitFor(() => {
      expect(apiMocks.mockFetchChats).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
        'alice-browser-key',
      )
      expect(apiMocks.mockFetchUsers).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
      )
    })

    await waitFor(() => {
      expect(screen.getByText('chat:bob:1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'chat:bob:1' }))

    await waitFor(() => {
      expect(apiMocks.mockFetchMessages).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
        'chat-1',
      )
      expect(screen.getByTestId('participant')).toHaveTextContent('bob')
      expect(screen.getByTestId('message-count')).toHaveTextContent('1')
    })

    await user.type(screen.getByLabelText('draft'), 'hello team')
    await user.click(screen.getByRole('button', { name: 'send message' }))

    expect(apiMocks.mockSendWebSocketCommand).toHaveBeenCalledWith(
      expect.objectContaining({ send: expect.any(Function) }),
      expect.objectContaining({
        type: 'MESSAGE',
        chatId: 'chat-1',
        text: 'hello team',
      }),
    )

    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      PRESENCE_PING_INTERVAL_MS,
    )
    expect(apiMocks.mockSendWebSocketCommand).toHaveBeenCalledWith(
      expect.objectContaining({ send: expect.any(Function) }),
      { type: 'PRESENCE' },
    )

    await waitFor(() => {
      expect(localStorage.getItem('whispers-read-markers:alice')).toContain('chat-1')
    })
  })

  test('waits for a browser private key before fetching chats', async () => {
    apiMocks.mockFetchChats.mockResolvedValue([{ chatId: 'chat-1', username: 'bob' }])
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'bob', lastPingTime: null }])
    privateServiceMocks.mockLoadPrivateChatBrowserIdentity.mockResolvedValue(null)

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

    await waitFor(() => {
      expect(
        privateServiceMocks.mockEnsureRegisteredPrivateChatBrowserIdentity,
      ).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
        'alice@example.com',
        ['user-1', 'alice'],
      )
      expect(apiMocks.mockFetchChats).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
        'alice-browser-key',
      )
    })
  })

  test('reacts to websocket events, creates chats, and disconnects cleanly', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockImplementation(async () => [
      { chatId: 'chat-1', username: 'bob' },
      ...(apiMocks.mockCreateChat.mock.calls.length > 0
        ? [{ chatId: 'chat-2', username: 'carol' }]
        : []),
    ])
    apiMocks.mockFetchUsers.mockResolvedValue([
      { username: 'bob', lastPingTime: null },
      { username: 'carol', lastPingTime: null },
    ])
    apiMocks.mockFetchMessages.mockImplementation(
      async (_serverUrl, _userId, chatId: string) => {
        if (chatId === 'chat-2') {
          return []
        }

        return [
          {
            chatId: 'chat-1',
            messageId: '100',
            senderUserId: 'bob',
            text: 'Initial hello',
            timestamp: '2026-04-12T10:00:00Z',
          },
        ]
      },
    )
    apiMocks.mockCreateChat.mockResolvedValue({ chatId: 'chat-2', username: 'carol' })

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
      socket.emitMessage(
        JSON.stringify({
          type: 'presence',
          username: 'bob',
          lastPingTime: '2026-04-12T10:05:00Z',
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('known-users')).toHaveTextContent('bob')
    })

    await act(async () => {
      socket.emitMessage(
        JSON.stringify({
          type: 'typing:start',
          chatId: 'chat-1',
          username: 'bob',
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('typing')).toHaveTextContent('bob')
    })

    await act(async () => {
      socket.emitMessage(
        JSON.stringify({
          type: 'MESSAGE',
          chatId: 'chat-1',
          messageId: 101,
          senderUserId: 'bob',
          text: 'Fresh update',
          timestamp: '2026-04-12T10:06:00Z',
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('message-count')).toHaveTextContent('2')
      expect(screen.getByTestId('last-message')).toHaveTextContent('Fresh update')
      expect(screen.getByTestId('typing')).toHaveTextContent('none')
      expect(screen.getByText('chat:bob:0')).toBeInTheDocument()
    })

    await act(async () => {
      socket.emitMessage(
        JSON.stringify({
          type: 'MESSAGE_EDIT',
          message: {
            chatId: 'chat-1',
            messageId: 101,
            senderUserId: 'bob',
            text: 'Fresh update edited',
            timestamp: '2026-04-12T10:06:00Z',
          },
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('message-count')).toHaveTextContent('2')
      expect(screen.getByTestId('last-message')).toHaveTextContent('Fresh update edited')
    })

    await act(async () => {
      socket.emitMessage(
        JSON.stringify({
          type: 'MESSAGE_DELETE',
          chatId: 'chat-1',
          messageId: 101,
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('message-count')).toHaveTextContent('1')
      expect(screen.getByTestId('last-message')).toHaveTextContent('Initial hello')
    })

    await user.type(screen.getByLabelText('new chat user'), 'carol')
    await user.click(screen.getByRole('button', { name: 'create chat' }))

    await waitFor(() => {
      expect(apiMocks.mockCreateChat).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
        'carol',
      )
      expect(screen.getByTestId('selected-chat')).toHaveTextContent('chat-2')
    })

    await act(async () => {
      socket.close()
    })

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('disconnected')
      expect(screen.getByTestId('selected-chat')).toHaveTextContent('none')
    })
  })

  test('requests chat deletion and removes a deleted chat from websocket events', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockResolvedValue([
      { chatId: 'chat-1', username: 'bob' },
      { chatId: 'chat-2', username: 'carol' },
    ])
    apiMocks.mockFetchUsers.mockResolvedValue([
      { username: 'bob', lastPingTime: null },
      { username: 'carol', lastPingTime: null },
    ])
    apiMocks.mockFetchMessages.mockImplementation(
      async (_serverUrl, _userId, chatId: string) => [
        {
          chatId,
          senderUserId: chatId === 'chat-1' ? 'bob' : 'carol',
          text: chatId === 'chat-1' ? 'Bob hello' : 'Carol hello',
          timestamp: '2026-04-12T10:00:00Z',
        },
      ],
    )
    apiMocks.mockDeleteChat.mockResolvedValue(undefined)

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

    await waitFor(() => {
      expect(screen.getByText('chat:bob:1')).toBeInTheDocument()
      expect(screen.getByText('chat:carol:1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'chat:bob:1' }))
    await user.click(screen.getByRole('button', { name: 'delete-chat:bob' }))

    await waitFor(() => {
      expect(apiMocks.mockDeleteChat).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
        'chat-1',
      )
    })

    await act(async () => {
      socket.emitMessage(
        JSON.stringify({
          type: 'CHAT_DELETE',
          chatId: 'chat-1',
        }),
      )
    })

    await waitFor(() => {
      expect(screen.queryByText('chat:bob:1')).not.toBeInTheDocument()
      expect(screen.queryByText('delete-chat:bob')).not.toBeInTheDocument()
      expect(screen.getByText('chat:carol:1')).toBeInTheDocument()
      expect(screen.getByTestId('selected-chat')).toHaveTextContent('none')
      expect(screen.getByTestId('participant')).toHaveTextContent('none')
    })
  })

  test('edits a selected own message while preserving the previous composer draft', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockResolvedValue([{ chatId: 'chat-1', username: 'bob' }])
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'bob', lastPingTime: null }])
    apiMocks.mockFetchMessages.mockResolvedValue([
      {
        chatId: 'chat-1',
        messageId: 'own-1',
        senderUserId: 'alice',
        text: 'Own hello',
        timestamp: '2026-04-12T10:00:00Z',
      },
    ])
    apiMocks.mockEditMessage.mockResolvedValue({
      chatId: 'chat-1',
      messageId: 'own-1',
      senderUserId: 'alice',
      text: 'Own hello edited',
      timestamp: '2026-04-12T10:00:00Z',
    })

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

    await waitFor(() => {
      expect(screen.getByText('chat:bob:0')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'chat:bob:0' }))

    await waitFor(() => {
      expect(screen.getByTestId('last-message')).toHaveTextContent('Own hello')
    })

    await user.type(screen.getByLabelText('draft'), 'new draft')
    await user.click(screen.getByRole('button', { name: 'edit own message' }))

    await waitFor(() => {
      expect(screen.getByLabelText('draft')).toHaveValue('Own hello')
    })

    await user.clear(screen.getByLabelText('draft'))
    await user.type(screen.getByLabelText('draft'), 'Own hello edited')
    await user.click(screen.getByRole('button', { name: 'send message' }))

    await waitFor(() => {
      expect(apiMocks.mockEditMessage).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
        'own-1',
        'Own hello edited',
      )
      expect(screen.getByLabelText('draft')).toHaveValue('new draft')
    })
  })

  test('handles invalid connection attempts and socket errors', async () => {
    const user = userEvent.setup()
    authMocks.mockRefreshSession.mockRejectedValueOnce(new Error('No refresh session'))

    const initialRender = render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('welcome-auth-status')).toHaveTextContent(
        'unauthenticated',
      )
    })
    await user.click(screen.getByRole('button', { name: 'connect workspace' }))

    expect(screen.getByTestId('welcome-auth-error')).toHaveTextContent(
      'Sign in first to connect the realtime workspace.',
    )

    authMocks.mockRefreshSession.mockResolvedValueOnce({
      accessToken: 'access-token',
      tokenType: 'Bearer',
      expiresInSeconds: 60 * 60,
      user: {
        userId: 'user-1',
        username: 'alice',
        email: 'alice@example.com',
        provider: 'google',
      },
    })
    initialRender.unmount()
    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await act(async () => {
      socket.emitError()
    })

    expect(screen.getByTestId('event-log')).toHaveTextContent('WebSocket error.')
  })

  test('starts and stops typing notifications as the draft changes', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockResolvedValue([{ chatId: 'chat-1', username: 'bob' }])
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'bob', lastPingTime: null }])
    apiMocks.mockFetchMessages.mockResolvedValue([
      {
        chatId: 'chat-1',
        senderUserId: 'bob',
        text: 'Ready when you are',
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
    })

    const baselineCalls = apiMocks.mockSendWebSocketCommand.mock.calls.length

    await user.type(screen.getByLabelText('draft'), 'h')

    await waitFor(() => {
      expect(apiMocks.mockSendWebSocketCommand.mock.calls.length).toBeGreaterThan(
        baselineCalls,
      )
      expect(apiMocks.mockSendWebSocketCommand).toHaveBeenCalledWith(
        expect.objectContaining({ send: expect.any(Function) }),
        { type: 'TYPING_START', chatId: 'chat-1' },
      )
    })

    await user.clear(screen.getByLabelText('draft'))

    await waitFor(() => {
      expect(apiMocks.mockSendWebSocketCommand).toHaveBeenCalledWith(
        expect.objectContaining({ send: expect.any(Function) }),
        { type: 'TYPING_END', chatId: 'chat-1' },
      )
    })
  })
})
