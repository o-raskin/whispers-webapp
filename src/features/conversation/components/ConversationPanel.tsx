import { useEffect, useRef } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import type { ConnectionStatus } from '../../../shared/types/chat'
import type { ChatThread, UserPresence } from '../../../shared/types/chat'
import {
  formatPresenceLabel,
  formatTimestamp,
  isUserOnline,
} from '../../../shared/utils/presence'

interface ConversationPanelProps {
  thread: ChatThread | null
  user: UserPresence | null
  currentUserId: string
  connectionStatus: ConnectionStatus
  isHistoryLoading: boolean
  messageDraft: string
  onMessageDraftChange: (value: string) => void
  onSendMessage: () => void
}

export function ConversationPanel({
  thread,
  user,
  currentUserId,
  connectionStatus,
  isHistoryLoading,
  messageDraft,
  onMessageDraftChange,
  onSendMessage,
}: ConversationPanelProps) {
  const historyRef = useRef<HTMLDivElement | null>(null)
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onMessageDraftChange(event.target.value)
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSendMessage()
    }
  }
  const handleSubmit = () => {
    onSendMessage()
  }
  const getInitials = (value: string) => value.slice(0, 2).toUpperCase()

  const subtitle = thread
    ? `Selected chat: ${thread.participant} (${isUserOnline(user) ? 'online' : 'offline'}, last ping: ${formatPresenceLabel(user?.lastPingTime ?? null)})`
    : 'No chat selected'

  useEffect(() => {
    historyRef.current?.scrollTo({
      top: historyRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [thread?.messages])

  return (
    <section className="conversation">
      <div className="conversation-header">
        <div className="conversation-persona">
          <div className={`conversation-avatar ${isUserOnline(user) ? 'online' : ''}`}>
            {thread ? getInitials(thread.participant) : 'W'}
          </div>
          <div>
            <p className="section-kicker">Live channel</p>
            <h2>{thread ? thread.participant : 'Welcome to Whispers'}</h2>
            <div className="conversation-subtitle">{subtitle}</div>
          </div>
        </div>
        <div className="conversation-summary">
          <span className={`status-pill ${connectionStatus}`}>{connectionStatus}</span>
          <div className="conversation-stat">
            {thread ? `${thread.messages.length} messages synced` : 'Realtime shell ready'}
          </div>
        </div>
      </div>

      <div className="history-shell">
        <div className="history-ribbon">
          <span className="history-ribbon-pill">Encrypted channel</span>
          <span className="history-ribbon-pill subtle">
            {thread ? 'Message stream live' : 'Select a chat to begin'}
          </span>
        </div>
        <div className="history" ref={historyRef}>
          {isHistoryLoading ? (
            <div className="history-loading" aria-label="Loading conversation">
              <div className="message-skeleton received" />
              <div className="message-skeleton sent" />
              <div className="message-skeleton received short" />
            </div>
          ) : thread ? (
          thread.messages.map((message) => (
            <article
              key={message.id}
              className={`message ${message.direction}`}
            >
              <span className="message-meta">
                {message.senderUserId === currentUserId ? 'You' : message.senderUserId} •{' '}
                {formatTimestamp(message.timestamp)}
              </span>
              {message.text}
            </article>
          ))
        ) : (
          <div className="welcome-panel">
            <div className="welcome-panel-mark" aria-hidden="true">
              W
            </div>
            <div className="welcome-panel-title">Your conversation space is ready.</div>
            <div className="welcome-panel-copy">
              Connect to the backend, pick a conversation, and the live thread will
              bloom here with message history, presence updates, and new activity.
            </div>
          </div>
          )}
        </div>
      </div>

      <form
        className="composer-panel"
        onSubmit={(event) => {
          event.preventDefault()
          handleSubmit()
        }}
      >
        <div className="composer">
          <label htmlFor="messageText">Message</label>
          <textarea
            id="messageText"
            placeholder={
              thread
                ? `Send a message to ${thread.participant}`
                : 'Choose a conversation to start typing'
            }
            value={messageDraft}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            rows={3}
            disabled={!thread}
          />
          <div className="composer-meta">
            <span>Enter to send</span>
            <span>{messageDraft.trim().length} chars</span>
          </div>
        </div>
        <button
          className="send-button"
          type="submit"
          disabled={!thread || connectionStatus !== 'connected'}
        >
          Send Message
        </button>
      </form>
    </section>
  )
}
