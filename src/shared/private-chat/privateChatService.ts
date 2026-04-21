import { registerPrivateChatKey } from '../api/privateChatApi'
import {
  generatePrivateChatBrowserKeyRecord,
  isPrivateChatCryptoSupported,
} from './privateChatCrypto'
import {
  browserPrivateChatKeyStore,
  type PrivateChatBrowserKeyRecord,
  type PrivateChatKeyStore,
} from './privateChatKeyStore'

export interface EnsurePrivateChatBrowserIdentityResult {
  identity: PrivateChatBrowserKeyRecord
  status: 'existing' | 'generated'
}

interface CreatePrivateChatKeyManagerOptions {
  keyStore?: PrivateChatKeyStore
  now?: () => string
  randomUUID?: () => string
}

function toOwnerLookupOrder(ownerId: string, fallbackOwnerIds: string[] = []) {
  const ownerIds = [ownerId, ...fallbackOwnerIds]
    .map((value) => value.trim())
    .filter(Boolean)

  return Array.from(new Set(ownerIds))
}

function getRuntimeRandomUuid() {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('Private chats need a browser runtime with secure random UUID support.')
  }

  return crypto.randomUUID()
}

export function isPrivateChatSupported() {
  return typeof indexedDB !== 'undefined' && isPrivateChatCryptoSupported()
}

export function createPrivateChatKeyManager({
  keyStore = browserPrivateChatKeyStore,
  now = () => new Date().toISOString(),
  randomUUID = getRuntimeRandomUuid,
}: CreatePrivateChatKeyManagerOptions = {}) {
  return {
    async ensureIdentity(
      ownerId: string,
      fallbackOwnerIds: string[] = [],
    ): Promise<EnsurePrivateChatBrowserIdentityResult> {
      const ownerLookupOrder = toOwnerLookupOrder(ownerId, fallbackOwnerIds)
      let existingIdentity: PrivateChatBrowserKeyRecord | null = null

      for (const candidateOwnerId of ownerLookupOrder) {
        existingIdentity = await keyStore.get(candidateOwnerId)

        if (!existingIdentity) {
          continue
        }

        if (candidateOwnerId !== ownerId) {
          existingIdentity = {
            ...existingIdentity,
            ownerId,
            updatedAt: now(),
          }
          await keyStore.put(existingIdentity)
        }

        break
      }

      if (existingIdentity) {
        return {
          identity: existingIdentity,
          status: 'existing',
        }
      }

      const createdAt = now()
      const generatedIdentity = await generatePrivateChatBrowserKeyRecord({
        createdAt,
        keyId: `browser-key-${randomUUID()}`,
        ownerId,
      })

      await keyStore.put(generatedIdentity)

      return {
        identity: generatedIdentity,
        status: 'generated',
      }
    },

    async loadIdentity(ownerId: string, fallbackOwnerIds: string[] = []) {
      const ownerLookupOrder = toOwnerLookupOrder(ownerId, fallbackOwnerIds)

      for (const candidateOwnerId of ownerLookupOrder) {
        const identity = await keyStore.get(candidateOwnerId)

        if (!identity) {
          continue
        }

        if (candidateOwnerId !== ownerId) {
          await keyStore.put({
            ...identity,
            ownerId,
          })
        }

        return identity
      }

      return null
    },
  }
}

const browserPrivateChatKeyManager = createPrivateChatKeyManager()

export async function loadPrivateChatBrowserIdentity(
  ownerId: string,
  fallbackOwnerIds: string[] = [],
) {
  return browserPrivateChatKeyManager.loadIdentity(ownerId, fallbackOwnerIds)
}

export async function ensurePrivateChatBrowserIdentity(
  ownerId: string,
  fallbackOwnerIds: string[] = [],
) {
  return browserPrivateChatKeyManager.ensureIdentity(ownerId, fallbackOwnerIds)
}

export async function registerPrivateChatBrowserIdentity(
  serverUrl: string,
  accessToken: string,
  identity: PrivateChatBrowserKeyRecord,
) {
  return registerPrivateChatKey(serverUrl, accessToken, {
    keyId: identity.keyId,
    publicKey: identity.publicKeyBase64,
    algorithm: identity.algorithm,
    format: identity.format,
  })
}

export async function ensureRegisteredPrivateChatBrowserIdentity(
  serverUrl: string,
  accessToken: string,
  ownerId: string,
  fallbackOwnerIds: string[] = [],
) {
  const result = await ensurePrivateChatBrowserIdentity(ownerId, fallbackOwnerIds)
  const registeredKey = await registerPrivateChatBrowserIdentity(
    serverUrl,
    accessToken,
    result.identity,
  )

  return {
    ...result,
    registeredKey,
  }
}
