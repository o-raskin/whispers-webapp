import type { EncryptedPrivateMessagePayload } from '../types/chat'
import type { PrivateChatBrowserKeyRecord } from './privateChatKeyStore'

const RSA_OAEP_ALGORITHM: RsaHashedKeyGenParams = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
}

const RSA_OAEP_IMPORT_ALGORITHM: RsaHashedImportParams = {
  name: 'RSA-OAEP',
  hash: 'SHA-256',
}

const AES_GCM_IMPORT_ALGORITHM: AesKeyAlgorithm = {
  name: 'AES-GCM',
  length: 256,
}

const PRIVATE_MESSAGE_NONCE_BYTES = 12

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export const PRIVATE_CHAT_PROTOCOL_VERSION = 'v1' as const
export const PRIVATE_CHAT_ENCRYPTION_ALGORITHM = 'AES-GCM' as const
export const PRIVATE_CHAT_KEY_WRAP_ALGORITHM = 'RSA-OAEP' as const
export const PRIVATE_CHAT_KEY_FORMAT = 'spki' as const

export type PrivateChatDecryptionResult =
  | { status: 'decrypted'; text: string }
  | { status: 'error'; message: string }
  | { status: 'missing-key' }

interface EncryptPrivateMessageOptions {
  recipientKeyId: string
  recipientPublicKey: CryptoKey
  senderIdentity: Pick<PrivateChatBrowserKeyRecord, 'keyId' | 'publicKey'>
  text: string
}

interface GeneratePrivateChatBrowserKeyRecordOptions {
  createdAt?: string
  keyId: string
  ownerId: string
}

function getRuntimeCrypto() {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Private chats need the Web Crypto API in this browser.')
  }

  return crypto
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  if (typeof btoa !== 'function') {
    throw new Error('Base64 encoding is not available in this runtime.')
  }

  return btoa(binary)
}

function base64ToBytes(value: string) {
  if (typeof atob !== 'function') {
    throw new Error('Base64 decoding is not available in this runtime.')
  }

  const decoded = atob(value)
  const bytes = new Uint8Array(decoded.length)

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index)
  }

  return bytes
}

function bufferToBase64(value: ArrayBuffer) {
  return bytesToBase64(new Uint8Array(value))
}

export function isPrivateChatCryptoSupported() {
  return typeof crypto !== 'undefined' && Boolean(crypto.subtle)
}

export async function importPrivateChatPublicKey(publicKeyBase64: string) {
  return getRuntimeCrypto().subtle.importKey(
    PRIVATE_CHAT_KEY_FORMAT,
    base64ToBytes(publicKeyBase64),
    RSA_OAEP_IMPORT_ALGORITHM,
    false,
    ['encrypt'],
  )
}

export async function generatePrivateChatBrowserKeyRecord({
  createdAt = new Date().toISOString(),
  keyId,
  ownerId,
}: GeneratePrivateChatBrowserKeyRecordOptions): Promise<PrivateChatBrowserKeyRecord> {
  const runtimeCrypto = getRuntimeCrypto()
  const keyPair = (await runtimeCrypto.subtle.generateKey(
    RSA_OAEP_ALGORITHM,
    false,
    ['encrypt', 'decrypt'],
  )) as CryptoKeyPair
  const publicKeyBase64 = bufferToBase64(
    await runtimeCrypto.subtle.exportKey(PRIVATE_CHAT_KEY_FORMAT, keyPair.publicKey),
  )

  return {
    ownerId,
    keyId,
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    publicKeyBase64,
    algorithm: PRIVATE_CHAT_KEY_WRAP_ALGORITHM,
    format: PRIVATE_CHAT_KEY_FORMAT,
    createdAt,
    updatedAt: createdAt,
  }
}

export async function encryptPrivateMessage({
  recipientKeyId,
  recipientPublicKey,
  senderIdentity,
  text,
}: EncryptPrivateMessageOptions): Promise<EncryptedPrivateMessagePayload> {
  const runtimeCrypto = getRuntimeCrypto()
  const nonce = runtimeCrypto.getRandomValues(new Uint8Array(PRIVATE_MESSAGE_NONCE_BYTES))
  const messageKey = await runtimeCrypto.subtle.generateKey(
    AES_GCM_IMPORT_ALGORITHM,
    true,
    ['encrypt', 'decrypt'],
  )
  const plaintext = textEncoder.encode(text)
  const ciphertext = await runtimeCrypto.subtle.encrypt(
    {
      name: PRIVATE_CHAT_ENCRYPTION_ALGORITHM,
      iv: nonce,
    },
    messageKey,
    plaintext,
  )
  const rawMessageKey = await runtimeCrypto.subtle.exportKey('raw', messageKey)
  const senderEnvelope = await runtimeCrypto.subtle.encrypt(
    { name: PRIVATE_CHAT_KEY_WRAP_ALGORITHM },
    senderIdentity.publicKey,
    rawMessageKey,
  )
  const recipientEnvelope = await runtimeCrypto.subtle.encrypt(
    { name: PRIVATE_CHAT_KEY_WRAP_ALGORITHM },
    recipientPublicKey,
    rawMessageKey,
  )

  return {
    protocolVersion: PRIVATE_CHAT_PROTOCOL_VERSION,
    encryptionAlgorithm: PRIVATE_CHAT_ENCRYPTION_ALGORITHM,
    keyWrapAlgorithm: PRIVATE_CHAT_KEY_WRAP_ALGORITHM,
    ciphertext: bufferToBase64(ciphertext),
    nonce: bytesToBase64(nonce),
    senderKeyId: senderIdentity.keyId,
    senderMessageKeyEnvelope: bufferToBase64(senderEnvelope),
    recipientKeyId,
    recipientMessageKeyEnvelope: bufferToBase64(recipientEnvelope),
  }
}

export async function decryptPrivateMessage(
  payload: EncryptedPrivateMessagePayload,
  identity: Pick<PrivateChatBrowserKeyRecord, 'keyId' | 'privateKey'>,
): Promise<PrivateChatDecryptionResult> {
  if (
    payload.protocolVersion !== PRIVATE_CHAT_PROTOCOL_VERSION ||
    payload.encryptionAlgorithm !== PRIVATE_CHAT_ENCRYPTION_ALGORITHM ||
    payload.keyWrapAlgorithm !== PRIVATE_CHAT_KEY_WRAP_ALGORITHM
  ) {
    return {
      status: 'error',
      message: 'This private message uses an unsupported protocol version.',
    }
  }

  let wrappedMessageKey: string | null = null

  if (payload.senderKeyId === identity.keyId) {
    wrappedMessageKey = payload.senderMessageKeyEnvelope
  } else if (payload.recipientKeyId === identity.keyId) {
    wrappedMessageKey = payload.recipientMessageKeyEnvelope
  }

  if (!wrappedMessageKey) {
    return { status: 'missing-key' }
  }

  try {
    const runtimeCrypto = getRuntimeCrypto()
    const rawMessageKey = await runtimeCrypto.subtle.decrypt(
      { name: PRIVATE_CHAT_KEY_WRAP_ALGORITHM },
      identity.privateKey,
      base64ToBytes(wrappedMessageKey),
    )
    const messageKey = await runtimeCrypto.subtle.importKey(
      'raw',
      rawMessageKey,
      AES_GCM_IMPORT_ALGORITHM,
      false,
      ['decrypt'],
    )
    const plaintext = await runtimeCrypto.subtle.decrypt(
      {
        name: PRIVATE_CHAT_ENCRYPTION_ALGORITHM,
        iv: base64ToBytes(payload.nonce),
      },
      messageKey,
      base64ToBytes(payload.ciphertext),
    )

    return {
      status: 'decrypted',
      text: textDecoder.decode(plaintext),
    }
  } catch {
    return {
      status: 'error',
      message: 'This private message could not be decrypted in this browser.',
    }
  }
}
