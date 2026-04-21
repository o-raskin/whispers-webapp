import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import './testUtils/realtimeAppModuleMocks'
import { App } from './App'
import { DEFAULT_WS_URL } from '../shared/config/backend'
import {
  apiMocks,
  privateApiMocks,
  privateCryptoMocks,
  privateServiceMocks,
} from './testUtils/realtimeAppModuleMocks'
import {
  connectAuthenticatedWorkspace,
  setupRealtimeAppTestEnvironment,
  teardownRealtimeAppTestEnvironment,
} from './testUtils/realtimeAppTestSetup'
import { emitSocketOpen } from './testUtils/realtimeAppTestUtils'

describe('App private chat flows', () => {
  beforeEach(() => {
    setupRealtimeAppTestEnvironment()
  })

  afterEach(() => {
    teardownRealtimeAppTestEnvironment()
  })

  test('creates private chats and sends encrypted websocket payloads', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockImplementation(async () =>
      privateApiMocks.mockCreatePrivateChat.mock.calls.length > 0
        ? [{ chatId: 'private-chat-1', username: 'private-bob', type: 'PRIVATE' }]
        : [],
    )
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'private-bob', lastPingTime: null }])
    privateApiMocks.mockCreatePrivateChat.mockResolvedValue({
      chatId: 'private-chat-1',
      username: 'private-bob',
      type: 'PRIVATE',
      firstName: null,
      lastName: null,
      profileUrl: null,
    })
    privateApiMocks.mockFetchPrivateChat.mockResolvedValue({
      chatId: 'private-chat-1',
      username: 'private-bob',
      type: 'PRIVATE',
      currentUserKey: {
        keyId: 'alice-browser-key',
        publicKey: 'alice-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
      counterpartKey: {
        keyId: 'bob-browser-key',
        publicKey: 'bob-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
    })
    privateApiMocks.mockFetchPrivateMessages.mockResolvedValue([])

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

    await user.type(screen.getByLabelText('new chat user'), 'private-bob')
    await user.click(screen.getByRole('button', { name: 'create private chat' }))

    await waitFor(() => {
      expect(privateApiMocks.mockCreatePrivateChat).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
        'private-bob',
        'alice-browser-key',
      )
      expect(screen.getByTestId('selected-chat')).toHaveTextContent('private-chat-1')
    })

    expect(
      privateServiceMocks.mockEnsureRegisteredPrivateChatBrowserIdentity,
    ).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(screen.getByTestId('chat-type')).toHaveTextContent('PRIVATE')
      expect(screen.getByTestId('private-state')).toHaveTextContent('ready')
    })

    await user.type(screen.getByLabelText('draft'), 'top secret')
    await user.click(screen.getByRole('button', { name: 'send message' }))

    await waitFor(() => {
      expect(privateCryptoMocks.mockEncryptPrivateMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'top secret',
          recipientKeyId: 'bob-browser-key',
        }),
      )
    })

    expect(apiMocks.mockSendWebSocketCommand).toHaveBeenCalledWith(
      expect.objectContaining({ send: expect.any(Function) }),
      expect.objectContaining({
        type: 'PRIVATE_MESSAGE',
        chatId: 'private-chat-1',
        privateMessage: expect.objectContaining({
          ciphertext: 'ciphertext',
          recipientKeyId: 'bob-browser-key',
          senderKeyId: 'alice-browser-key',
        }),
      }),
    )
  })

  test('enriches private chat participant info the same way as direct chats', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockResolvedValue([
      { chatId: 'private-chat-1', username: 'bob', type: 'PRIVATE' },
    ])
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'bob', lastPingTime: null }])
    privateApiMocks.mockFetchPrivateChat.mockResolvedValue({
      chatId: 'private-chat-1',
      username: 'bob',
      type: 'PRIVATE',
      currentUserKey: {
        keyId: 'alice-browser-key',
        publicKey: 'alice-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
      counterpartKey: {
        keyId: 'bob-browser-key',
        publicKey: 'bob-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
    })
    privateApiMocks.mockFetchPrivateMessages.mockResolvedValue([])

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

    await waitFor(() => {
      expect(apiMocks.mockFetchUserProfile).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
        'bob',
      )
    })

    await user.click(screen.getByRole('button', { name: 'chat:bob:0' }))

    await waitFor(() => {
      expect(screen.getByTestId('participant-profile-name')).toHaveTextContent('Bob Example')
      expect(screen.getByTestId('chat-type')).toHaveTextContent('PRIVATE')
    })
  })

  test('opens a private chat with an email-keyed browser identity', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockResolvedValue([
      { chatId: 'private-chat-1', username: 'private-bob', type: 'PRIVATE' },
    ])
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'private-bob', lastPingTime: null }])
    privateApiMocks.mockFetchPrivateChat.mockResolvedValue({
      chatId: 'private-chat-1',
      username: 'private-bob',
      type: 'PRIVATE',
      currentUserKey: {
        keyId: 'alice-browser-key',
        publicKey: 'alice-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
      counterpartKey: {
        keyId: 'bob-browser-key',
        publicKey: 'bob-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
    })
    privateApiMocks.mockFetchPrivateMessages.mockResolvedValue([])

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

    await waitFor(() => {
      expect(screen.getByText('chat:private-bob:0')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'chat:private-bob:0' }))

    await waitFor(() => {
      expect(privateServiceMocks.mockLoadPrivateChatBrowserIdentity).toHaveBeenCalledWith(
        'alice@example.com',
        ['user-1', 'alice'],
      )
      expect(privateApiMocks.mockFetchPrivateMessages).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
        'private-chat-1',
        'alice-browser-key',
      )
      expect(screen.getByTestId('private-state')).toHaveTextContent('ready')
    })
  })

  test('shows a recovery state when the private browser key is missing', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockResolvedValue([
      { chatId: 'private-chat-1', username: 'private-bob', type: 'PRIVATE' },
    ])
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'private-bob', lastPingTime: null }])
    privateServiceMocks.mockLoadPrivateChatBrowserIdentity.mockResolvedValue(null)
    privateApiMocks.mockFetchPrivateChat.mockResolvedValue({
      chatId: 'private-chat-1',
      username: 'private-bob',
      type: 'PRIVATE',
      currentUserKey: {
        keyId: 'alice-browser-key',
        publicKey: 'alice-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
      counterpartKey: {
        keyId: 'bob-browser-key',
        publicKey: 'bob-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
    })
    privateApiMocks.mockFetchPrivateMessages.mockResolvedValue([
      {
        chatId: 'private-chat-1',
        senderUserId: 'private-bob',
        chatType: 'PRIVATE',
        encryptedMessage: {
          protocolVersion: 'v1',
          encryptionAlgorithm: 'AES-GCM',
          keyWrapAlgorithm: 'RSA-OAEP',
          ciphertext: 'ciphertext',
          nonce: 'nonce',
          senderKeyId: 'bob-browser-key',
          senderMessageKeyEnvelope: 'sender-envelope',
          recipientKeyId: 'alice-browser-key',
          recipientMessageKeyEnvelope: 'recipient-envelope',
        },
        timestamp: '2026-04-20T10:01:00Z',
      },
    ])

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

    await waitFor(() => {
      expect(screen.getByText('chat:private-bob:0')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'chat:private-bob:0' }))

    await waitFor(() => {
      expect(screen.getByTestId('chat-type')).toHaveTextContent('PRIVATE')
      expect(screen.getByTestId('private-state')).toHaveTextContent('missing-key')
      expect(screen.getByTestId('private-notice')).toHaveTextContent(
        /does not have the saved private key/i,
      )
      expect(screen.getByTestId('last-message')).toHaveTextContent('no-messages')
    })

    expect(privateApiMocks.mockFetchPrivateMessages).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'set up private chat' }))

    await waitFor(() => {
      expect(
        privateServiceMocks.mockEnsureRegisteredPrivateChatBrowserIdentity,
      ).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
        'alice@example.com',
        ['user-1', 'alice'],
      )
      expect(privateApiMocks.mockFetchPrivateMessages).toHaveBeenCalledWith(
        DEFAULT_WS_URL,
        'access-token',
        'private-chat-1',
        'alice-browser-key',
      )
      expect(screen.getByTestId('private-state')).toHaveTextContent('ready')
      expect(screen.getByTestId('last-message')).toHaveTextContent('Decrypted hello')
    })
  })

  test('keeps a private chat ready after the websocket echoes a sent message', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockResolvedValue([
      { chatId: 'private-chat-1', username: 'private-bob', type: 'PRIVATE' },
    ])
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'private-bob', lastPingTime: null }])
    privateApiMocks.mockFetchPrivateChat.mockResolvedValue({
      chatId: 'private-chat-1',
      username: 'private-bob',
      type: 'PRIVATE',
      currentUserKey: {
        keyId: 'alice-browser-key',
        publicKey: 'alice-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
      counterpartKey: {
        keyId: 'bob-browser-key',
        publicKey: 'bob-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
    })
    privateApiMocks.mockFetchPrivateMessages.mockResolvedValue([])
    privateCryptoMocks.mockDecryptPrivateMessage.mockImplementation(
      async (_payload, identity) => (identity
        ? {
            status: 'decrypted',
            text: 'Echoed private message',
          }
        : {
            status: 'missing-key',
          }),
    )

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

    await waitFor(() => {
      expect(screen.getByText('chat:private-bob:0')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'chat:private-bob:0' }))

    await waitFor(() => {
      expect(screen.getByTestId('private-state')).toHaveTextContent('ready')
    })

    await user.type(screen.getByLabelText('draft'), 'hello again')
    await user.click(screen.getByRole('button', { name: 'send message' }))

    privateServiceMocks.mockLoadPrivateChatBrowserIdentity.mockResolvedValue(null)

    await act(async () => {
      socket.emitMessage(JSON.stringify({
        type: 'PRIVATE_MESSAGE',
        chatId: 'private-chat-1',
        senderUsername: 'alice',
        chatType: 'PRIVATE',
        encryptedMessage: {
          protocolVersion: 'v1',
          encryptionAlgorithm: 'AES-GCM',
          keyWrapAlgorithm: 'RSA-OAEP',
          ciphertext: 'ciphertext',
          nonce: 'nonce',
          senderKeyId: 'alice-browser-key',
          senderMessageKeyEnvelope: 'sender-envelope',
          recipientKeyId: 'bob-browser-key',
          recipientMessageKeyEnvelope: 'recipient-envelope',
        },
        timestamp: '2026-04-22T00:44:00Z',
      }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('private-state')).toHaveTextContent('ready')
      expect(screen.getByTestId('draft-disabled')).toHaveTextContent('false')
      expect(screen.getByTestId('private-notice')).toHaveTextContent(
        'Private messages are end-to-end encrypted and tied to this browser.',
      )
      expect(screen.getByTestId('last-message')).toHaveTextContent(
        'Echoed private message',
      )
      expect(screen.getByTestId('last-direction')).toHaveTextContent('sent')
    })
  })

  test('treats an email-keyed websocket echo as a sent private message for the current user', async () => {
    const user = userEvent.setup()

    apiMocks.mockFetchChats.mockResolvedValue([
      { chatId: 'private-chat-1', username: 'private-bob', type: 'PRIVATE' },
    ])
    apiMocks.mockFetchUsers.mockResolvedValue([{ username: 'private-bob', lastPingTime: null }])
    privateApiMocks.mockFetchPrivateChat.mockResolvedValue({
      chatId: 'private-chat-1',
      username: 'private-bob',
      type: 'PRIVATE',
      currentUserKey: {
        keyId: 'alice-browser-key',
        publicKey: 'alice-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
      counterpartKey: {
        keyId: 'bob-browser-key',
        publicKey: 'bob-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      },
    })
    privateApiMocks.mockFetchPrivateMessages.mockResolvedValue([])
    privateCryptoMocks.mockDecryptPrivateMessage.mockResolvedValue({
      status: 'decrypted',
      text: 'Email-keyed echo',
    })

    render(<App />)

    const socket = await connectAuthenticatedWorkspace()
    await emitSocketOpen(socket)

    await waitFor(() => {
      expect(screen.getByText('chat:private-bob:0')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'chat:private-bob:0' }))

    await waitFor(() => {
      expect(screen.getByTestId('private-state')).toHaveTextContent('ready')
    })

    await act(async () => {
      socket.emitMessage(JSON.stringify({
        type: 'PRIVATE_MESSAGE',
        chatId: 'private-chat-1',
        senderUsername: 'alice@example.com',
        chatType: 'PRIVATE',
        encryptedMessage: {
          protocolVersion: 'v1',
          encryptionAlgorithm: 'AES-GCM',
          keyWrapAlgorithm: 'RSA-OAEP',
          ciphertext: 'ciphertext',
          nonce: 'nonce',
          senderKeyId: 'alice-browser-key',
          senderMessageKeyEnvelope: 'sender-envelope',
          recipientKeyId: 'bob-browser-key',
          recipientMessageKeyEnvelope: 'recipient-envelope',
        },
        timestamp: '2026-04-22T01:07:00Z',
      }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('last-message')).toHaveTextContent('Email-keyed echo')
      expect(screen.getByTestId('last-direction')).toHaveTextContent('sent')
      expect(screen.getByTestId('draft-disabled')).toHaveTextContent('false')
    })
  })
})
