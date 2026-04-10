import type { ChangeEvent } from 'react'
import type { ChatThread, UserPresence } from '../../../shared/types/chat'
import {
  formatPresenceLabel,
  formatTimestamp,
  isUserOnline,
} from '../../../shared/utils/presence'

interface ConversationPanelProps {
  thread: ChatThread | null
  user: UserPresence | null
  messageDraft: string
  onMessageDraftChange: (value: string) => void
  onSendMessage: () => void
}

export function ConversationPanel({
  thread,
  user,
  messageDraft,
  onMessageDraftChange,
  onSendMessage,
}: ConversationPanelProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onMessageDraftChange(event.target.value)
  }

  const subtitle = thread
    ? `Selected chat: ${thread.participant} (${isUserOnline(user) ? 'online' : 'offline'}, last ping: ${formatPresenceLabel(user?.lastPingTime ?? null)})`
    : 'No chat selected'

  return (
    <section className="conversation">
      <div className="conversation-header">
        <div>
          <h2>Conversation</h2>
          <div className="conversation-subtitle">{subtitle}</div>
        </div>
      </div>

      <div className="history">
        {thread ? (
          thread.messages.map((message) => (
            <article
              key={message.id}
                className={`message ${message.direction}`}
              >
                <span className="message-meta">
                  {message.senderUserId} • {formatTimestamp(message.timestamp)}
                </span>
                {message.text}
              </article>
          ))
        ) : (
          <div className="message system">
            Select or create a chat to see message history.
          </div>
        )}
      </div>

      <div className="composer">
        <div>
          <label htmlFor="messageText">Message</label>
          <input
            id="messageText"
            placeholder="hello there"
            value={messageDraft}
            onChange={handleChange}
          />
        </div>
        <div>
          <button type="button" onClick={onSendMessage} disabled={!thread}>
            Send
          </button>
        </div>
      </div>
    </section>
  )
}
