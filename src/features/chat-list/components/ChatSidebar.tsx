import type { ChangeEvent } from 'react'
import type { ConnectionStatus } from '../../../shared/types/chat'
import type { ChatSummary, UserPresence } from '../../../shared/types/chat'
import { formatPresenceLabel, isUserOnline } from '../../../shared/utils/presence'

interface ChatSidebarProps {
  chats: ChatSummary[]
  selectedChatId: string | null
  users: Record<string, UserPresence>
  status: ConnectionStatus
  newChatUserId: string
  onNewChatUserIdChange: (value: string) => void
  onCreateChat: () => void
  onSelectChat: (chatId: string) => void
}

export function ChatSidebar({
  chats,
  selectedChatId,
  users,
  status,
  newChatUserId,
  onNewChatUserIdChange,
  onCreateChat,
  onSelectChat,
}: ChatSidebarProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onNewChatUserIdChange(event.target.value)
  }

  const getInitials = (value: string) => value.slice(0, 2).toUpperCase()

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div>
          <p className="section-kicker">Inbox</p>
          <h2>Conversations</h2>
          <p className="sidebar-note">
            Your private channels, presence signals, and the latest activity in one
            calm view.
          </p>
        </div>
        <div className="sidebar-count">{chats.length}</div>
      </div>

      <div className="create-chat-card">
        <label htmlFor="newChatUserId">Start a new chat</label>
        <div className="create-chat">
          <input
            id="newChatUserId"
            placeholder="username"
            value={newChatUserId}
            onChange={handleChange}
          />
          <button type="button" onClick={onCreateChat}>
            Create
          </button>
        </div>
      </div>

      <div className="chat-list">
        {chats.length === 0 ? (
          <div className="empty-panel">
            <div className="empty-orb" aria-hidden="true" />
            <div className="empty-title">
              {status === 'connected' ? 'No chats yet' : 'Waiting for connection'}
            </div>
            <div className="empty-copy">
              {status === 'connected'
                ? 'Create a conversation with an online user to bring this inbox to life.'
                : 'Connect with your user identity to load conversations from the backend.'}
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
                <div className="chat-item-top">
                  <div className={`chat-avatar ${online ? 'online' : ''}`}>
                    {getInitials(chat.username)}
                  </div>
                  <div className="chat-item-main">
                    <div className="chat-item-title">
                      <span>{chat.username}</span>
                      <span
                        className={`presence-dot ${online ? 'connected' : ''}`}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="chat-item-meta">
                      {online ? 'Online now' : 'Away'} • Last ping:{' '}
                      {formatPresenceLabel(user?.lastPingTime ?? null)}
                    </div>
                  </div>
                  {chat.unreadCount && chat.unreadCount > 0 ? (
                    <span className="chat-badge">{chat.unreadCount}</span>
                  ) : null}
                </div>
                {chat.preview ? (
                  <div className="chat-item-preview">{chat.preview}</div>
                ) : (
                  <div className="chat-item-preview">No messages yet.</div>
                )}
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}
