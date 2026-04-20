import {
  decryptPrivateMessage,
  encryptPrivateMessage,
  generatePrivateChatBrowserKeyRecord,
  importPrivateChatPublicKey,
  PRIVATE_CHAT_ENCRYPTION_ALGORITHM,
  PRIVATE_CHAT_KEY_WRAP_ALGORITHM,
  PRIVATE_CHAT_PROTOCOL_VERSION,
} from './privateChatCrypto'

describe('privateChatCrypto', () => {
  test('encrypts once and allows both recipient and sender to decrypt', async () => {
    const sender = await generatePrivateChatBrowserKeyRecord({
      keyId: 'alice-browser-key',
      ownerId: 'alice',
    })
    const recipient = await generatePrivateChatBrowserKeyRecord({
      keyId: 'bob-browser-key',
      ownerId: 'bob',
    })
    const importedRecipientPublicKey = await importPrivateChatPublicKey(
      recipient.publicKeyBase64,
    )

    const payload = await encryptPrivateMessage({
      text: 'hello from private mode',
      senderIdentity: sender,
      recipientKeyId: recipient.keyId,
      recipientPublicKey: importedRecipientPublicKey,
    })

    expect(payload).toEqual({
      protocolVersion: PRIVATE_CHAT_PROTOCOL_VERSION,
      encryptionAlgorithm: PRIVATE_CHAT_ENCRYPTION_ALGORITHM,
      keyWrapAlgorithm: PRIVATE_CHAT_KEY_WRAP_ALGORITHM,
      ciphertext: expect.any(String),
      nonce: expect.any(String),
      senderKeyId: 'alice-browser-key',
      senderMessageKeyEnvelope: expect.any(String),
      recipientKeyId: 'bob-browser-key',
      recipientMessageKeyEnvelope: expect.any(String),
    })

    await expect(decryptPrivateMessage(payload, recipient)).resolves.toEqual({
      status: 'decrypted',
      text: 'hello from private mode',
    })

    await expect(decryptPrivateMessage(payload, sender)).resolves.toEqual({
      status: 'decrypted',
      text: 'hello from private mode',
    })
  })

  test('returns a missing-key result when the payload targets another browser key', async () => {
    const sender = await generatePrivateChatBrowserKeyRecord({
      keyId: 'alice-browser-key',
      ownerId: 'alice',
    })
    const recipient = await generatePrivateChatBrowserKeyRecord({
      keyId: 'bob-browser-key',
      ownerId: 'bob',
    })
    const stranger = await generatePrivateChatBrowserKeyRecord({
      keyId: 'carol-browser-key',
      ownerId: 'carol',
    })

    const payload = await encryptPrivateMessage({
      text: 'browser bound',
      senderIdentity: sender,
      recipientKeyId: recipient.keyId,
      recipientPublicKey: recipient.publicKey,
    })

    await expect(decryptPrivateMessage(payload, stranger)).resolves.toEqual({
      status: 'missing-key',
    })
  })
})
