import { motion } from 'framer-motion'
import type { ConnectionStatus } from '../../../shared/types/chat'
import { ConnectionControls } from '../../connection/components/ConnectionControls'
import {
  itemReveal,
  listStagger,
  panelTransition,
  sectionReveal,
} from '../../../shared/motion/presets'
import './WelcomeExperience.css'

interface WelcomeExperienceProps {
  serverUrl: string
  userId: string
  status: ConnectionStatus
  onServerUrlChange: (value: string) => void
  onUserIdChange: (value: string) => void
  onConnect: () => void
  onDisconnect: () => void
}

export function WelcomeExperience({
  serverUrl,
  userId,
  status,
  onServerUrlChange,
  onUserIdChange,
  onConnect,
  onDisconnect,
}: WelcomeExperienceProps) {
  const profileLabel = userId.trim() ? `Identity: ${userId.trim()}` : 'Identity: ready to connect'
  const statusCopy = {
    connected: 'Realtime channel is live. Step into the workspace and continue the conversation.',
    connecting: 'Negotiating a secure session with your backend now.',
    disconnected: 'Point the client at your backend and sign in with your user identity.',
  }[status]

  return (
    <motion.div
      className="welcome-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.42 } }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="welcome-surface"
        variants={sectionReveal}
        initial="hidden"
        animate="visible"
        exit={{ opacity: 0, y: -16, scale: 0.985, filter: 'blur(16px)' }}
        transition={panelTransition}
      >
        <div className="welcome-backdrop-grid" aria-hidden="true" />
        <motion.div className="welcome-content" variants={listStagger}>
          <motion.div className="welcome-copy" variants={itemReveal}>
            <p className="eyebrow">Flagship realtime messaging</p>
            <h2 className="welcome-headline">
              Quiet power, cinematic presence, and elite product polish.
            </h2>

            <div className="welcome-chips" role="list" aria-label="Welcome highlights">
              <span className="welcome-chip" role="listitem">
                Realtime WebSocket
              </span>
              <span className="welcome-chip" role="listitem">
                Presence-aware threads
              </span>
              <span className="welcome-chip" role="listitem">
                Production-grade shell
              </span>
            </div>
          </motion.div>

          <motion.div className="welcome-glance" variants={itemReveal}>
            <div className="welcome-glance-panel">
              <div className="welcome-glance-topline">
                <span className="welcome-profile">{profileLabel}</span>
              </div>

              <div className="welcome-connect-block">
                <div className="welcome-connect-heading">Connection gateway</div>
                <div className="welcome-connect-copy">
                  Configure the realtime endpoint and enter your user identity to open
                  the workspace like a proper authorization screen.
                </div>
                <ConnectionControls
                  serverUrl={serverUrl}
                  userId={userId}
                  status={status}
                  onServerUrlChange={onServerUrlChange}
                  onUserIdChange={onUserIdChange}
                  onConnect={onConnect}
                  onDisconnect={onDisconnect}
                  idPrefix="welcome"
                  layout="stacked"
                  showStatusRow={false}
                  showDisconnect={false}
                />
                <div className="welcome-connect-note">{statusCopy}</div>
              </div>

              <div className="welcome-trace">
                <div className="welcome-trace-line">
                  <span className="welcome-trace-dot" />
                  Secure session controls initialized
                </div>
                <div className="welcome-trace-line">
                  <span className="welcome-trace-dot" />
                  Endpoint and identity can be configured here
                </div>
                <div className="welcome-trace-line">
                  <span className="welcome-trace-dot" />
                  Ready for focused conversation handoff
                </div>
              </div>
            </div>
          </motion.div>

          <motion.p className="welcome-caption" variants={itemReveal}>
            The workspace unlocks automatically once a live connection is established.
          </motion.p>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
