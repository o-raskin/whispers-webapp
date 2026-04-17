import { AnimatePresence, motion } from 'framer-motion'
import { itemReveal, panelTransition } from '../../../shared/motion/presets'

interface ChatSidebarHeaderProps {
  isInfoOpen: boolean
  onToggleInfo: () => void
}

export function ChatSidebarHeader({
  isInfoOpen,
  onToggleInfo,
}: ChatSidebarHeaderProps) {
  return (
    <motion.div className="sidebar-header" variants={itemReveal}>
      <div>
        <p className="section-kicker">Inbox</p>
        <div className="sidebar-title-row">
          <h2>Conversations</h2>
          <div className="sidebar-info">
            <button
              className={`sidebar-info-button ${isInfoOpen ? 'is-active' : ''}`}
              type="button"
              aria-label="About conversations"
              aria-expanded={isInfoOpen}
              aria-controls="conversations-info"
              onClick={onToggleInfo}
            >
              i
            </button>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {isInfoOpen ? (
            <motion.div
              id="conversations-info"
              className="sidebar-info-panel"
              initial={{ opacity: 0, y: -6, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -6, filter: 'blur(8px)' }}
              transition={panelTransition}
            >
              Your private channels, presence signals, and the latest activity in one
              calm view.
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
