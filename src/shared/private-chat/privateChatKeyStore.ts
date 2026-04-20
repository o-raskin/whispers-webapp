import type {
  PrivateChatKeyFormat,
  PrivateChatKeyWrapAlgorithm,
} from '../types/chat'

const PRIVATE_CHAT_KEY_DB_NAME = 'whispers-private-chat'
const PRIVATE_CHAT_KEY_STORE_NAME = 'browser-keys'

export interface PrivateChatBrowserKeyRecord {
  ownerId: string
  keyId: string
  publicKey: CryptoKey
  privateKey: CryptoKey
  publicKeyBase64: string
  algorithm: PrivateChatKeyWrapAlgorithm
  format: PrivateChatKeyFormat
  createdAt: string
  updatedAt: string
}

export interface PrivateChatKeyStore {
  delete: (ownerId: string) => Promise<void>
  get: (ownerId: string) => Promise<PrivateChatBrowserKeyRecord | null>
  put: (record: PrivateChatBrowserKeyRecord) => Promise<void>
}

let databasePromise: Promise<IDBDatabase> | null = null

function getIndexedDbFactory() {
  if (typeof indexedDB === 'undefined') {
    throw new Error('Private chats need IndexedDB support in this browser.')
  }

  return indexedDB
}

function wrapRequest<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB request failed.'))
    }
  })
}

function openDatabase() {
  if (databasePromise) {
    return databasePromise
  }

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = getIndexedDbFactory().open(PRIVATE_CHAT_KEY_DB_NAME, 1)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(PRIVATE_CHAT_KEY_STORE_NAME)) {
        database.createObjectStore(PRIVATE_CHAT_KEY_STORE_NAME, {
          keyPath: 'ownerId',
        })
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(request.error ?? new Error('Could not open the private chat key store.'))
    }
  })

  return databasePromise
}

export function createIndexedDbPrivateChatKeyStore(): PrivateChatKeyStore {
  return {
    async delete(ownerId) {
      const database = await openDatabase()
      const transaction = database.transaction(PRIVATE_CHAT_KEY_STORE_NAME, 'readwrite')
      const store = transaction.objectStore(PRIVATE_CHAT_KEY_STORE_NAME)
      await wrapRequest(store.delete(ownerId))
    },

    async get(ownerId) {
      const database = await openDatabase()
      const transaction = database.transaction(PRIVATE_CHAT_KEY_STORE_NAME, 'readonly')
      const store = transaction.objectStore(PRIVATE_CHAT_KEY_STORE_NAME)
      const result = await wrapRequest(store.get(ownerId))
      return (result as PrivateChatBrowserKeyRecord | undefined) ?? null
    },

    async put(record) {
      const database = await openDatabase()
      const transaction = database.transaction(PRIVATE_CHAT_KEY_STORE_NAME, 'readwrite')
      const store = transaction.objectStore(PRIVATE_CHAT_KEY_STORE_NAME)
      await wrapRequest(store.put(record))
    },
  }
}

export const browserPrivateChatKeyStore = createIndexedDbPrivateChatKeyStore()
