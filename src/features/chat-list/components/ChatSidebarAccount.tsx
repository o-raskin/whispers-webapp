import { AnimatePresence, motion } from 'framer-motion'
import type { RefObject } from 'react'
import { itemReveal, panelTransition, springTransition } from '../../../shared/motion/presets'
import { getInitials } from './chatSidebarShared'

interface ChatSidebarAccountProps {
  currentUserLabel: string
  isUserMenuOpen: boolean
  userMenuRef: RefObject<HTMLDivElement | null>
  onDisconnect: () => void
  onToggleUserMenu: () => void
  onCloseUserMenu: () => void
}

export function ChatSidebarAccount({
  currentUserLabel,
  isUserMenuOpen,
  userMenuRef,
  onDisconnect,
  onToggleUserMenu,
  onCloseUserMenu,
}: ChatSidebarAccountProps) {
  return (
    <motion.div className="sidebar-user-shell" variants={itemReveal} ref={userMenuRef}>
      <div className="sidebar-user-divider" aria-hidden="true" />
      <AnimatePresence>
        {isUserMenuOpen ? (
          <motion.div
            className="sidebar-user-menu"
            id="account-menu"
            role="menu"
            aria-label="Account menu"
            initial={{ opacity: 0, y: 10, scale: 0.96, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 8, scale: 0.97, filter: 'blur(6px)' }}
            transition={panelTransition}
          >
            <div className="sidebar-user-menu-header">Account</div>
            <button
              className="sidebar-user-menu-item danger"
              type="button"
              role="menuitem"
              onClick={() => {
                onCloseUserMenu()
                onDisconnect()
              }}
            >
              Disconnect
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="sidebar-user-card">
        <div className="sidebar-user-avatar">{getInitials(currentUserLabel)}</div>
        <div className="sidebar-user-copy">
          <span className="sidebar-user-label">Signed in as</span>
          <strong>{currentUserLabel}</strong>
        </div>
        <motion.button
          className={`sidebar-user-action ${isUserMenuOpen ? 'is-open' : ''}`}
          type="button"
          aria-haspopup="menu"
          aria-expanded={isUserMenuOpen}
          aria-controls="account-menu"
          aria-label="Open account menu"
          onClick={onToggleUserMenu}
          whileTap={{ scale: 0.96 }}
          transition={springTransition}
        >
          <span className={`sidebar-user-action-icon ${isUserMenuOpen ? 'is-open' : ''}`} aria-hidden="true">
            <span className="sidebar-user-action-line" />
            <span className="sidebar-user-action-line" />
            <span className="sidebar-user-action-line" />
          </span>
        </motion.button>
      </div>
    </motion.div>
  )
}
