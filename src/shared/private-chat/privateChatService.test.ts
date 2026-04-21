import {
  createPrivateChatKeyManager,
} from './privateChatService'
import type {
  PrivateChatBrowserKeyRecord,
  PrivateChatKeyStore,
} from './privateChatKeyStore'

function createMemoryKeyStore(): PrivateChatKeyStore {
  const records = new Map<string, PrivateChatBrowserKeyRecord>()

  return {
    async delete(ownerId) {
      records.delete(ownerId)
    },
    async get(ownerId) {
      return records.get(ownerId) ?? null
    },
    async put(record) {
      records.set(record.ownerId, record)
    },
  }
}

describe('privateChatService', () => {
  test('generates and then reuses the same browser key for one owner', async () => {
    const manager = createPrivateChatKeyManager({
      keyStore: createMemoryKeyStore(),
      now: () => '2026-04-20T10:00:00Z',
      randomUUID: () => 'key-1',
    })

    const first = await manager.ensureIdentity('alice')
    const second = await manager.ensureIdentity('alice')

    expect(first.status).toBe('generated')
    expect(first.identity.ownerId).toBe('alice')
    expect(first.identity.keyId).toBe('browser-key-key-1')
    expect(first.identity.algorithm).toBe('RSA-OAEP')
    expect(first.identity.format).toBe('spki')
    expect(first.identity.publicKeyBase64).toEqual(expect.any(String))
    expect(first.identity.createdAt).toBe('2026-04-20T10:00:00Z')
    expect(second.status).toBe('existing')
    expect(second.identity.keyId).toBe(first.identity.keyId)
    expect(second.identity.publicKeyBase64).toBe(first.identity.publicKeyBase64)
  })

  test('reuses a legacy username-owned key for a stable owner id and migrates it', async () => {
    const keyStore = createMemoryKeyStore()
    const manager = createPrivateChatKeyManager({
      keyStore,
      now: () => '2026-04-21T12:00:00Z',
      randomUUID: () => 'key-2',
    })

    await keyStore.put({
      ownerId: 'alice',
      keyId: 'browser-key-legacy',
      publicKey: {} as CryptoKey,
      privateKey: {} as CryptoKey,
      publicKeyBase64: 'legacy-public-key',
      algorithm: 'RSA-OAEP',
      format: 'spki',
      createdAt: '2026-04-20T10:00:00Z',
      updatedAt: '2026-04-20T10:00:00Z',
    })

    const result = await manager.ensureIdentity('user-1', ['alice'])
    const migratedRecord = await keyStore.get('user-1')

    expect(result.status).toBe('existing')
    expect(result.identity.keyId).toBe('browser-key-legacy')
    expect(result.identity.ownerId).toBe('user-1')
    expect(result.identity.updatedAt).toBe('2026-04-21T12:00:00Z')
    expect(migratedRecord?.keyId).toBe('browser-key-legacy')
  })
})
