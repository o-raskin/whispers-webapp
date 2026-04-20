import { waitFor } from '@testing-library/react'
import {
  getLatestMockWebSocket,
  installRealtimeAppBrowserMocks,
  resetRealtimeAppBrowserMocks,
} from './realtimeAppTestUtils'
import {
  apiMocks,
  authMocks,
  privateApiMocks,
  privateCryptoMocks,
  privateServiceMocks,
} from './realtimeAppModuleMocks'

const DEFAULT_AUTH_USER = {
  userId: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
  provider: 'google',
}

const DEFAULT_BROWSER_IDENTITY = {
  ownerId: 'alice',
  keyId: 'alice-browser-key',
  publicKey: {} as CryptoKey,
  privateKey: {} as CryptoKey,
  publicKeyBase64: 'alice-public-key',
  algorithm: 'RSA-OAEP',
  format: 'spki',
  createdAt: '2026-04-20T10:00:00Z',
  updatedAt: '2026-04-20T10:00:00Z',
}

const DEFAULT_REGISTERED_KEY = {
  keyId: 'alice-browser-key',
  publicKey: 'alice-public-key',
  algorithm: 'RSA-OAEP',
  format: 'spki',
  status: 'ACTIVE',
  createdAt: '2026-04-20T10:00:00Z',
  updatedAt: '2026-04-20T10:00:00Z',
}

export function setupRealtimeAppTestEnvironment() {
  installRealtimeAppBrowserMocks()

  authMocks.mockRefreshSession.mockResolvedValue({
    accessToken: 'access-token',
    tokenType: 'Bearer',
    expiresInSeconds: 60 * 60,
    user: DEFAULT_AUTH_USER,
  })
  authMocks.mockFetchCurrentUser.mockResolvedValue(DEFAULT_AUTH_USER)
  authMocks.mockLoginWithProvider.mockReset()
  authMocks.mockLogoutCurrentSession.mockReset()

  privateApiMocks.mockCreatePrivateChat.mockReset()
  privateApiMocks.mockFetchPrivateChat.mockReset()
  privateApiMocks.mockFetchPrivateMessages.mockReset()

  privateServiceMocks.mockEnsureRegisteredPrivateChatBrowserIdentity.mockReset()
  privateServiceMocks.mockIsPrivateChatSupported.mockReset()
  privateServiceMocks.mockLoadPrivateChatBrowserIdentity.mockReset()
  privateServiceMocks.mockRegisterPrivateChatBrowserIdentity.mockReset()

  privateCryptoMocks.mockDecryptPrivateMessage.mockReset()
  privateCryptoMocks.mockEncryptPrivateMessage.mockReset()
  privateCryptoMocks.mockImportPrivateChatPublicKey.mockReset()

  privateServiceMocks.mockIsPrivateChatSupported.mockReturnValue(true)
  privateServiceMocks.mockEnsureRegisteredPrivateChatBrowserIdentity.mockResolvedValue({
    identity: DEFAULT_BROWSER_IDENTITY,
    status: 'existing',
    registeredKey: DEFAULT_REGISTERED_KEY,
  })
  privateServiceMocks.mockLoadPrivateChatBrowserIdentity.mockResolvedValue(
    DEFAULT_BROWSER_IDENTITY,
  )
  privateServiceMocks.mockRegisterPrivateChatBrowserIdentity.mockResolvedValue(
    DEFAULT_REGISTERED_KEY,
  )

  privateApiMocks.mockFetchPrivateChat.mockResolvedValue({
    chatId: 'private-chat-1',
    username: 'bob',
    type: 'PRIVATE',
    currentUserKey: DEFAULT_REGISTERED_KEY,
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
  privateCryptoMocks.mockDecryptPrivateMessage.mockResolvedValue({
    status: 'decrypted',
    text: 'Decrypted hello',
  })
  privateCryptoMocks.mockImportPrivateChatPublicKey.mockResolvedValue({} as CryptoKey)
  privateCryptoMocks.mockEncryptPrivateMessage.mockResolvedValue({
    protocolVersion: 'v1',
    encryptionAlgorithm: 'AES-GCM',
    keyWrapAlgorithm: 'RSA-OAEP',
    ciphertext: 'ciphertext',
    nonce: 'nonce',
    senderKeyId: 'alice-browser-key',
    senderMessageKeyEnvelope: 'sender-envelope',
    recipientKeyId: 'bob-browser-key',
    recipientMessageKeyEnvelope: 'recipient-envelope',
  })
}

export function teardownRealtimeAppTestEnvironment() {
  resetRealtimeAppBrowserMocks()

  apiMocks.mockBuildWebSocketProtocols.mockClear()
  apiMocks.mockBuildWebSocketUrl.mockClear()
  apiMocks.mockCreateChat.mockReset()
  apiMocks.mockFetchChats.mockReset()
  apiMocks.mockFetchMessages.mockReset()
  apiMocks.mockFetchUserProfile.mockClear()
  apiMocks.mockFetchUsers.mockReset()
  apiMocks.mockSendWebSocketCommand.mockClear()

  authMocks.mockFetchCurrentUser.mockReset()
  authMocks.mockLoginWithProvider.mockReset()
  authMocks.mockLogoutCurrentSession.mockReset()
  authMocks.mockRefreshSession.mockReset()

  privateApiMocks.mockCreatePrivateChat.mockReset()
  privateApiMocks.mockFetchPrivateChat.mockReset()
  privateApiMocks.mockFetchPrivateMessages.mockReset()

  privateServiceMocks.mockEnsureRegisteredPrivateChatBrowserIdentity.mockReset()
  privateServiceMocks.mockIsPrivateChatSupported.mockReset()
  privateServiceMocks.mockLoadPrivateChatBrowserIdentity.mockReset()
  privateServiceMocks.mockRegisterPrivateChatBrowserIdentity.mockReset()

  privateCryptoMocks.mockDecryptPrivateMessage.mockReset()
  privateCryptoMocks.mockEncryptPrivateMessage.mockReset()
  privateCryptoMocks.mockImportPrivateChatPublicKey.mockReset()
}

export async function connectAuthenticatedWorkspace() {
  await waitFor(() => {
    expect(getLatestMockWebSocket()).toBeDefined()
  })

  return getLatestMockWebSocket()
}

export function mockDirectChatBootstrap(
  initialMessage = 'Ready when you are',
  chatId = 'chat-1',
  username = 'bob',
) {
  apiMocks.mockFetchChats.mockResolvedValue([{ chatId, username }])
  apiMocks.mockFetchUsers.mockResolvedValue([{ username, lastPingTime: null }])
  apiMocks.mockFetchMessages.mockResolvedValue([
    {
      chatId,
      senderUserId: username,
      text: initialMessage,
      timestamp: '2026-04-12T10:00:00Z',
    },
  ])
}
