import type { ChangeEvent } from 'react'
import type { ConnectionStatus } from '../../../shared/types/chat'

interface ConnectionPanelProps {
  serverUrl: string
  userId: string
  status: ConnectionStatus
  onServerUrlChange: (value: string) => void
  onUserIdChange: (value: string) => void
  onConnect: () => void
  onDisconnect: () => void
}

export function ConnectionPanel({
  serverUrl,
  userId,
  status,
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

  return (
    <section className="topbar">
      <h1>Whispers Test Client</h1>
      <div className="connection-grid">
        <div>
          <label htmlFor="serverUrl">Server URL</label>
          <input
            id="serverUrl"
            value={serverUrl}
            onChange={handleInput(onServerUrlChange)}
          />
        </div>
        <div>
          <label htmlFor="userId">Your user ID</label>
          <input
            id="userId"
            placeholder="alice"
            value={userId}
            onChange={handleInput(onUserIdChange)}
          />
        </div>
        <div>
          <button type="button" onClick={onConnect}>
            Connect
          </button>
        </div>
        <div>
          <button className="secondary" type="button" onClick={onDisconnect}>
            Disconnect
          </button>
        </div>
      </div>
      <p className="status">
        <span className={`status-pill ${status}`}>{status}</span>
      </p>
    </section>
  )
}
