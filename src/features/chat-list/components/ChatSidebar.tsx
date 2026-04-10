import type { ChangeEvent } from 'react'
import type { ChatSummary, UserPresence } from '../../../shared/types/chat'
import { formatPresenceLabel, isUserOnline } from '../../../shared/utils/presence'

interface ChatSidebarProps {
  chats: ChatSummary[]
  selectedChatId: string | null
  users: Record<string, UserPresence>
  newChatUserId: string
  onNewChatUserIdChange: (value: string) => void
  onCreateChat: () => void
  onSelectChat: (chatId: string) => void
}

export function ChatSidebar({
  chats,
  selectedChatId,
  users,
  newChatUserId,
  onNewChatUserIdChange,
  onCreateChat,
  onSelectChat,
}: ChatSidebarProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onNewChatUserIdChange(event.target.value)
  }

  return (
    <aside className="sidebar">
      <h2>Chats</h2>
      <p className="sidebar-note">Chats are loaded from the server after connection.</p>

      <div className="create-chat">
        <input
          placeholder="username"
          value={newChatUserId}
          onChange={handleChange}
        />
        <button type="button" onClick={onCreateChat}>
          Create Chat
        </button>
      </div>

      <div className="chat-list">
        {chats.length === 0 ? (
          <div className="chat-item">
            <div className="chat-item-title">No chats yet</div>
            <div className="chat-item-preview">
              Connect and create a chat with an online user.
            </div>
          </div>
        ) : (
          chats.map((chat) => {
            const user = users[chat.username]
            const isActive = chat.chatId === selectedChatId
            const online = isUserOnline(user)

            return (
              <button
                key={chat.chatId}
                className={`chat-item ${isActive ? 'active' : ''}`}
                type="button"
                onClick={() => onSelectChat(chat.chatId)}
              >
                <div className="chat-item-title">
                  <span
                    className={`presence-dot ${online ? 'connected' : ''}`}
                  />
                  <span>{chat.username}</span>
                  {chat.unreadCount && chat.unreadCount > 0 ? (
                    <span className="chat-badge">{chat.unreadCount}</span>
                  ) : null}
                </div>
                {chat.preview ? (
                  <div className="chat-item-preview">{chat.preview}</div>
                ) : null}
                <div className="chat-item-meta">
                  {online ? 'Connected' : 'Disconnected'} • Last ping:{' '}
                  {formatPresenceLabel(user?.lastPingTime ?? null)}
                </div>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}
