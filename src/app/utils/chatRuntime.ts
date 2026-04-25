import type {
  ChatMessage,
  ChatSummary,
  ChatThread,
  MessageRecord,
} from '../../shared/types/chat'
import { isCallSignalText } from '../../shared/utils/callSignals'

export interface HydratedChatSummary {
  lastMessageTimestamp?: string
  preview: string
  unreadCount: number
}

export function filterVisibleMessages(messages: MessageRecord[]) {
  return messages.filter((message) => !isCallSignalText(message.text))
}

export function createSystemMessage(chatId: string, text: string): ChatMessage {
  return {
    id: `system-${chatId}-${Date.now()}`,
    chatId,
    senderUserId: 'system',
    direction: 'system',
    text,
    timestamp: new Date().toISOString(),
  }
}

export function mergeThreadMessages(
  existingMessages: ChatMessage[] | undefined,
  incomingMessages: ChatMessage[],
) {
  const mergedMessagesById = new Map(
    existingMessages?.map((message) => [message.id, message]) ?? [],
  )

  const shouldReplaceExistingMessage = (
    existingMessage: ChatMessage,
    incomingMessage: ChatMessage,
  ) => {
    if (
      existingMessage.encryption?.mode === 'PRIVATE' &&
      incomingMessage.encryption?.mode === 'PRIVATE'
    ) {
      if (existingMessage.encryption.state === incomingMessage.encryption.state) {
        return existingMessage.text !== incomingMessage.text
      }

      return incomingMessage.encryption.state === 'decrypted'
    }

    return false
  }

  for (const message of incomingMessages) {
    const existingMessage = mergedMessagesById.get(message.id)

    if (!existingMessage || shouldReplaceExistingMessage(existingMessage, message)) {
      mergedMessagesById.set(message.id, message)
    }
  }

  const mergedMessages = [...mergedMessagesById.values()]
  mergedMessages.sort((left, right) => left.timestamp.localeCompare(right.timestamp))
  return mergedMessages
}

export function upsertThread(
  currentThreads: Record<string, ChatThread>,
  chatId: string,
  participant: string,
  incomingMessages: ChatMessage[],
) {
  const existingThread = currentThreads[chatId]

  return {
    ...currentThreads,
    [chatId]: {
      chatId,
      participant,
      messages: mergeThreadMessages(existingThread?.messages, incomingMessages),
    },
  }
}

export function removeMessageFromThread(
  currentThreads: Record<string, ChatThread>,
  chatId: string,
  messageId: string,
) {
  const existingThread = currentThreads[chatId]

  if (!existingThread) {
    return currentThreads
  }

  const remainingMessages = existingThread.messages.filter(
    (message) => message.messageId !== messageId,
  )

  if (remainingMessages.length === existingThread.messages.length) {
    return currentThreads
  }

  return {
    ...currentThreads,
    [chatId]: {
      ...existingThread,
      messages: remainingMessages,
    },
  }
}

export function syncChatAfterMessageRemoval(
  currentChats: ChatSummary[],
  chatId: string,
  remainingMessages: ChatMessage[],
) {
  const latestMessage = remainingMessages.at(-1)

  return currentChats.map((chat) =>
    chat.chatId === chatId
      ? {
          ...chat,
          preview: latestMessage?.text ?? '',
          lastMessageTimestamp: latestMessage?.timestamp,
        }
      : chat,
  )
}

export function mergeFetchedChats(
  currentChats: ChatSummary[],
  incomingChats: ChatSummary[],
) {
  return incomingChats.map((chat) => {
    const existingChat = currentChats.find((item) => item.chatId === chat.chatId)
    const hasHiddenPreview = Boolean(chat.preview && isCallSignalText(chat.preview))

    return {
      ...chat,
      preview: hasHiddenPreview ? existingChat?.preview : chat.preview ?? existingChat?.preview,
      lastMessageTimestamp: hasHiddenPreview
        ? existingChat?.lastMessageTimestamp
        : chat.lastMessageTimestamp ?? existingChat?.lastMessageTimestamp,
      unreadCount: existingChat?.unreadCount ?? 0,
    }
  })
}

export function hydrateFetchedChats(
  currentChats: ChatSummary[],
  hydratedByChatId: Map<string, HydratedChatSummary>,
  selectedChatId: string | null,
) {
  return currentChats.map((chat) => {
    const hydrated = hydratedByChatId.get(chat.chatId)

    if (!hydrated) {
      return chat
    }

    const existingTimestamp = chat.lastMessageTimestamp
    const hydratedTimestamp = hydrated.lastMessageTimestamp
    const shouldKeepExistingTimestamp =
      typeof existingTimestamp === 'string' &&
      typeof hydratedTimestamp === 'string' &&
      existingTimestamp.localeCompare(hydratedTimestamp) > 0

    if (shouldKeepExistingTimestamp) {
      return chat
    }

    return {
      ...chat,
      preview: hydrated.preview || chat.preview,
      lastMessageTimestamp: hydrated.lastMessageTimestamp ?? chat.lastMessageTimestamp,
      unreadCount: selectedChatId === chat.chatId ? 0 : hydrated.unreadCount,
    }
  })
}

export function setChatPreview(
  currentChats: ChatSummary[],
  chatId: string,
  preview: string,
) {
  return currentChats.map((chat) => (chat.chatId === chatId ? { ...chat, preview } : chat))
}

export function setChatTimestamp(
  currentChats: ChatSummary[],
  chatId: string,
  lastMessageTimestamp: string,
) {
  return currentChats.map((chat) =>
    chat.chatId === chatId ? { ...chat, lastMessageTimestamp } : chat,
  )
}

export function clearChatUnreadCount(
  currentChats: ChatSummary[],
  chatId: string,
) {
  return currentChats.map((chat) =>
    chat.chatId === chatId ? { ...chat, unreadCount: 0 } : chat,
  )
}

export function applyIncomingMessageToChats(
  currentChats: ChatSummary[],
  message: ChatMessage,
  selectedChatId: string | null,
  currentUserId: string,
) {
  if (!currentChats.some((chat) => chat.chatId === message.chatId)) {
    return null
  }

  return currentChats.map((chat) =>
    chat.chatId === message.chatId
      ? {
          ...chat,
          lastMessageTimestamp: message.timestamp,
          preview: message.text,
          unreadCount:
            selectedChatId === message.chatId || message.senderUserId === currentUserId
              ? 0
              : (chat.unreadCount ?? 0) + 1,
        }
      : chat,
  )
}
