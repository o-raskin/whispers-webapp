import type { ChangeEvent } from 'react'
import type { ConnectionStatus } from '../../../shared/types/chat'

interface ConnectionPanelProps {
  serverUrl: string
  userId: string
  status: ConnectionStatus
  chatCount: number
  onlineCount: number
  unreadCount: number
  onServerUrlChange: (value: string) => void
  onUserIdChange: (value: string) => void
  onConnect: () => void
  onDisconnect: () => void
}

export function ConnectionPanel({
  serverUrl,
  userId,
  status,
  chatCount,
  onlineCount,
  unreadCount,
  onServerUrlChange,
  onUserIdChange,
  onConnect,
  onDisconnect,
}: ConnectionPanelProps) {
  const handleInput =
    (setter: (value: string) => void) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setter(event.target.value)
    }

  const statusCopy = {
    connected: 'Realtime channel is live. Conversations and presence stay in sync.',
    connecting: 'Establishing a secure realtime tunnel to your backend.',
    disconnected: 'Connect with your user identity to unlock chats and live presence.',
  }[status]

  return (
    <section className="topbar">
      <div className="topbar-hero">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            W
          </div>
          <div className="brand-copy">
            <p className="eyebrow">Premium realtime messaging</p>
            <h1>Whispers</h1>
            <p className="hero-copy">
              A cinematic command deck for private conversations, presence, and live
              coordination.
            </p>
          </div>
        </div>

        <div className="hero-metrics" aria-label="Chat metrics">
          <article className="metric-card">
            <span className="metric-label">Conversations</span>
            <strong>{chatCount}</strong>
          </article>
          <article className="metric-card">
            <span className="metric-label">Online now</span>
            <strong>{onlineCount}</strong>
          </article>
          <article className="metric-card">
            <span className="metric-label">Unread</span>
            <strong>{unreadCount}</strong>
          </article>
        </div>
      </div>

      <div className="connection-grid">
        <div className="field-card">
          <label htmlFor="serverUrl">Server URL</label>
          <input
            id="serverUrl"
            value={serverUrl}
            onChange={handleInput(onServerUrlChange)}
          />
        </div>
        <div className="field-card">
          <label htmlFor="userId">Your user ID</label>
          <input
            id="userId"
            placeholder="alice"
            value={userId}
            onChange={handleInput(onUserIdChange)}
          />
        </div>
        <div className="button-stack">
          <button type="button" onClick={onConnect}>
            Connect
          </button>
        </div>
        <div className="button-stack">
          <button className="secondary" type="button" onClick={onDisconnect}>
            Disconnect
          </button>
        </div>
      </div>

      <div className="status-row">
        <span className={`status-pill ${status}`}>{status}</span>
        <p className="status-copy">{statusCopy}</p>
      </div>
    </section>
  )
}
