import {
  createPrivateChat,
  fetchPrivateChat,
  fetchPrivateMessages,
  registerPrivateChatKey,
} from './privateChatApi'

describe('privateChatApi', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('registers the current browser public key', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        keyId: 'alice-browser-key',
        publicKey: 'alice-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
        status: 'ACTIVE',
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-04-20T10:00:00Z',
      }),
    })

    await expect(
      registerPrivateChatKey('wss://chat.example.com/ws/user', 'access-token', {
        keyId: 'alice-browser-key',
        publicKey: 'alice-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
      }),
    ).resolves.toEqual({
      keyId: 'alice-browser-key',
      publicKey: 'alice-public-key',
      algorithm: 'RSA-OAEP',
      format: 'spki',
      status: 'ACTIVE',
      createdAt: '2026-04-20T10:00:00Z',
      updatedAt: '2026-04-20T10:00:00Z',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://chat.example.com/public-keys',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer access-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyId: 'alice-browser-key',
          publicKey: 'alice-public-key',
          algorithm: 'RSA-OAEP',
          format: 'spki',
        }),
      }),
    )
  })

  test('creates and fetches private chat resources', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          chatId: 456,
          username: 'bob@example.com',
          type: 'PRIVATE',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          chatId: 456,
          username: 'bob@example.com',
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
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            chatId: 456,
            senderUsername: 'bob@example.com',
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
        ]),
      })

    await expect(
      createPrivateChat(
        'ws://localhost:8080/ws/user',
        'access-token',
        'bob@example.com',
        'alice-browser-key',
      ),
    ).resolves.toEqual({
      chatId: '456',
      username: 'bob@example.com',
      type: 'PRIVATE',
      firstName: null,
      lastName: null,
      profileUrl: null,
    })

    await expect(
      fetchPrivateChat(
        'ws://localhost:8080/ws/user',
        'access-token',
        '456',
        'alice-browser-key',
      ),
    ).resolves.toEqual({
      chatId: '456',
      username: 'bob@example.com',
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

    await expect(
      fetchPrivateMessages(
        'ws://localhost:8080/ws/user',
        'access-token',
        '456',
        'alice-browser-key',
      ),
    ).resolves.toEqual([
      {
        chatId: '456',
        senderUserId: 'bob@example.com',
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

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:8080/private-chats?targetUserId=bob%40example.com&keyId=alice-browser-key',
      expect.objectContaining({
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:8080/private-chats/456?keyId=alice-browser-key',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer access-token',
        },
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://localhost:8080/private-chats/456/messages?keyId=alice-browser-key',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer access-token',
        },
      }),
    )
  })

  test('retries browser key registration with compatible serialization variants', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('Unsupported key format'),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            keyId: 'alice-browser-key',
            publicKey: 'alice-public-key',
            algorithm: 'RSA-OAEP',
            format: 'spki',
            status: 'ACTIVE',
            createdAt: '2026-04-20T10:00:00Z',
            updatedAt: '2026-04-20T10:00:00Z',
          }),
        ),
      })

    await expect(
      registerPrivateChatKey('ws://localhost:8080/ws/user', 'access-token', {
        keyId: 'alice-browser-key',
        publicKey: 'alice-public-key',
        algorithm: 'RSA-OAEP',
        format: 'spki',
      }),
    ).resolves.toEqual({
      keyId: 'alice-browser-key',
      publicKey: 'alice-public-key',
      algorithm: 'RSA-OAEP',
      format: 'spki',
      status: 'ACTIVE',
      createdAt: '2026-04-20T10:00:00Z',
      updatedAt: '2026-04-20T10:00:00Z',
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:8080/public-keys',
      expect.objectContaining({
        body: JSON.stringify({
          keyId: 'alice-browser-key',
          publicKey: 'alice-public-key',
          algorithm: 'RSA-OAEP',
          format: 'SPKI',
        }),
      }),
    )
  })
})
