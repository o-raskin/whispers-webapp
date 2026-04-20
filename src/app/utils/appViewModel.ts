import type { AuthUserProfile } from '../../shared/types/auth'
import type { ChatSummary, ChatThread, UserPresence } from '../../shared/types/chat'
import type { AuthStatus } from './authFlow'
import {
  DEFAULT_PRIVATE_CHAT_SESSION_STATE,
  type PrivateChatSessionState,
} from './privateChatRuntime'

interface DeriveAppViewModelArgs {
  authStatus: AuthStatus
  authUser: AuthUserProfile | null
  chats: ChatSummary[]
  isMobileLayout: boolean
  messageDraft: string
  privateChatSessions: Record<string, PrivateChatSessionState>
  remoteTypingByChatId: Record<string, string>
  selectedChatId: string | null
  threads: Record<string, ChatThread>
  users: Record<string, UserPresence>
}

export function deriveAppViewModel({
  authStatus,
  authUser,
  chats,
  isMobileLayout,
  messageDraft,
  privateChatSessions,
  remoteTypingByChatId,
  selectedChatId,
  threads,
  users,
}: DeriveAppViewModelArgs) {
  const currentUserId = authUser?.username.trim() ?? ''
  const selectedThread = selectedChatId ? threads[selectedChatId] ?? null : null
  const selectedChatSummary = selectedChatId
    ? chats.find((chat) => chat.chatId === selectedChatId) ?? null
    : null
  const selectedUser = selectedThread ? users[selectedThread.participant] ?? null : null
  const selectedPrivateChatSession =
    selectedChatSummary?.type === 'PRIVATE'
      ? privateChatSessions[selectedChatSummary.chatId] ?? DEFAULT_PRIVATE_CHAT_SESSION_STATE
      : null

  return {
    currentUserId,
    isDrafting: Boolean(messageDraft.trim()),
    isMobileChatOpen: isMobileLayout && Boolean(selectedChatId),
    remoteTypingLabel: selectedChatId ? remoteTypingByChatId[selectedChatId] ?? null : null,
    selectedChatSummary,
    selectedPrivateChatSession,
    selectedThread,
    selectedUser,
    showWelcome: authStatus !== 'authenticated',
  }
}
