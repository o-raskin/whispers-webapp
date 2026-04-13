import type { ChangeEvent } from 'react'
import { motion } from 'framer-motion'
import type { ConnectionStatus } from '../../../shared/types/chat'
import {
  itemReveal,
  listStagger,
  springTransition,
} from '../../../shared/motion/presets'

interface ConnectionControlsProps {
  serverUrl: string
  userId: string
  status: ConnectionStatus
  onServerUrlChange: (value: string) => void
  onUserIdChange: (value: string) => void
  onConnect: () => void
  onDisconnect: () => void
  idPrefix?: string
  layout?: 'inline' | 'stacked'
  showStatusRow?: boolean
  showDisconnect?: boolean
}

export function ConnectionControls({
  serverUrl,
  userId,
  status,
  onServerUrlChange,
  onUserIdChange,
  onConnect,
  onDisconnect,
  idPrefix = 'connection',
  layout = 'inline',
  showStatusRow = true,
  showDisconnect = true,
}: ConnectionControlsProps) {
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
    <>
      <motion.div
        className={`connection-grid connection-grid--${layout}`}
        variants={listStagger}
      >
        <motion.div className="field-card" variants={itemReveal}>
          <label htmlFor={`${idPrefix}-server-url`}>Server URL</label>
          <input
            id={`${idPrefix}-server-url`}
            value={serverUrl}
            onChange={handleInput(onServerUrlChange)}
          />
        </motion.div>
        <motion.div className="field-card" variants={itemReveal}>
          <label htmlFor={`${idPrefix}-user-id`}>Your user ID</label>
          <input
            id={`${idPrefix}-user-id`}
            placeholder="alice"
            value={userId}
            onChange={handleInput(onUserIdChange)}
          />
        </motion.div>
        <motion.div
          className={`connection-actions connection-actions--${layout}`}
          variants={itemReveal}
        >
          <motion.button
            type="button"
            onClick={onConnect}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            transition={springTransition}
          >
            Connect
          </motion.button>
          {showDisconnect ? (
            <motion.button
              className="secondary"
              type="button"
              onClick={onDisconnect}
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.985 }}
              transition={springTransition}
            >
              Disconnect
            </motion.button>
          ) : null}
        </motion.div>
      </motion.div>

      {showStatusRow ? (
        <motion.div className="status-row" variants={itemReveal}>
          <motion.span
            className={`status-pill ${status}`}
            layout
            transition={springTransition}
          >
            {status}
          </motion.span>
          <p className="status-copy">{statusCopy}</p>
        </motion.div>
      ) : null}
    </>
  )
}
