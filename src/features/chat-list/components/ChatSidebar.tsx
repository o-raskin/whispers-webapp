import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ConnectionStatus } from '../../../shared/types/chat'
import type { ChatSummary, UserPresence } from '../../../shared/types/chat'
import {
  itemReveal,
  listStagger,
  panelTransition,
  sectionReveal,
  springTransition,
} from '../../../shared/motion/presets'
import { formatChatListTimestamp, isUserOnline } from '../../../shared/utils/presence'

interface ChatSidebarProps {
  currentUserId: string
  chats: ChatSummary[]
  selectedChatId: string | null
  users: Record<string, UserPresence>
  status: ConnectionStatus
  newChatUserId: string
  onNewChatUserIdChange: (value: string) => void
  onCreateChat: () => void
  onSelectChat: (chatId: string) => void
  onDisconnect: () => void
}

export function ChatSidebar({
  currentUserId,
  chats,
  selectedChatId,
  users,
  status,
  newChatUserId,
  onNewChatUserIdChange,
  onCreateChat,
  onSelectChat,
  onDisconnect,
}: ChatSidebarProps) {
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [activeUserMenuScope, setActiveUserMenuScope] = useState<string | null>(null)
  const [sidebarFadeState, setSidebarFadeState] = useState({
    showTopFade: false,
    showBottomFade: false,
  })

  const updateSidebarFadeState = useCallback(() => {
    const sidebarScrollElement = sidebarScrollRef.current

    if (!sidebarScrollElement) {
      setSidebarFadeState({
        showTopFade: false,
        showBottomFade: false,
      })
      return
    }

    const { scrollTop, scrollHeight, clientHeight } = sidebarScrollElement
    const maxScrollTop = Math.max(scrollHeight - clientHeight, 0)
    const threshold = 6
    const hasOverflow = maxScrollTop > threshold

    setSidebarFadeState({
      showTopFade: hasOverflow && scrollTop > threshold,
      showBottomFade: hasOverflow && scrollTop < maxScrollTop - threshold,
    })
  }, [])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onNewChatUserIdChange(event.target.value)
  }

  const getInitials = (value: string) => value.slice(0, 2).toUpperCase()
  const currentUserLabel = currentUserId.trim() || 'Guest'
  const userMenuScope = `${currentUserLabel}:${status}`
  const isUserMenuOpen = activeUserMenuScope === userMenuScope

  useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      updateSidebarFadeState()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [chats, isInfoOpen, status, updateSidebarFadeState])

  useEffect(() => {
    window.addEventListener('resize', updateSidebarFadeState)

    return () => {
      window.removeEventListener('resize', updateSidebarFadeState)
    }
  }, [updateSidebarFadeState])

  useEffect(() => {
    if (!isUserMenuOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target

      if (!(target instanceof Node)) {
        return
      }

      if (userMenuRef.current?.contains(target)) {
        return
      }

      setActiveUserMenuScope(null)
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isUserMenuOpen])

  useEffect(() => {
    if (!isUserMenuOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveUserMenuScope(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isUserMenuOpen])

  return (
    <motion.aside className="sidebar" variants={sectionReveal}>
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
                onClick={() => setIsInfoOpen((current) => !current)}
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

      <motion.div className="create-chat-card" variants={itemReveal}>
        <div className="create-chat">
          <input
            id="newChatUserId"
            placeholder="search"
            aria-label="Search user to start a new chat"
            value={newChatUserId}
            onChange={handleChange}
          />
          <motion.button
            className="create-chat-button"
            type="button"
            aria-label="Start chat"
            onClick={onCreateChat}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            transition={springTransition}
          >
            <span className="create-chat-button-icon" aria-hidden="true" />
          </motion.button>
        </div>
      </motion.div>

      <motion.div className="sidebar-scroll-viewport" variants={itemReveal}>
        <div
          className={`sidebar-edge-fade top ${sidebarFadeState.showTopFade ? 'visible' : ''}`}
          aria-hidden="true"
        />
        <div
          className={`sidebar-edge-fade bottom ${sidebarFadeState.showBottomFade ? 'visible' : ''}`}
          aria-hidden="true"
        />
        <motion.div
          ref={sidebarScrollRef}
          className="sidebar-scroll"
          onScroll={updateSidebarFadeState}
        >
          <motion.div className="chat-list" variants={listStagger} layout>
            <AnimatePresence initial={false}>
              {chats.length === 0 ? (
                <motion.div
                  key={`empty-${status}`}
                  className="empty-panel"
                  variants={itemReveal}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
                >
                  <div className="empty-orb" aria-hidden="true" />
                  <div className="empty-title">
                    {status === 'connected' ? 'No chats yet' : 'Waiting for connection'}
                  </div>
                  <div className="empty-copy">
                    {status === 'connected'
                      ? 'Create a conversation with an online user to bring this inbox to life.'
                      : 'Connect with your user identity to load conversations from the backend.'}
                  </div>
                </motion.div>
              ) : (
                chats.map((chat, index) => {
                  const isActive = chat.chatId === selectedChatId
                  const online = isUserOnline(users[chat.username])
                  const lastMessageTime = formatChatListTimestamp(chat.lastMessageTimestamp)

                  return (
                    <motion.button
                      key={chat.chatId}
                      className={`chat-item ${isActive ? 'active' : ''}`}
                      type="button"
                      onClick={() => onSelectChat(chat.chatId)}
                      layout
                      variants={itemReveal}
                      initial="hidden"
                      animate="visible"
                      exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
                      whileTap={{ scale: 0.992 }}
                      transition={{
                        ...panelTransition,
                        delay: index * 0.02,
                      }}
                    >
                      {isActive ? (
                        <motion.div
                          className="chat-item-glow"
                          layoutId="active-chat-card"
                          transition={panelTransition}
                        />
                      ) : null}
                      <div className="chat-item-top">
                        <div className={`chat-avatar ${online ? 'online' : ''}`}>
                          {getInitials(chat.username)}
                        </div>
                        <div className="chat-item-title">{chat.username}</div>
                        <div className="chat-item-preview">
                          {chat.preview || 'No messages yet.'}
                        </div>
                        <div className="chat-item-side">
                          {lastMessageTime ? (
                            <div className="chat-item-time">{lastMessageTime}</div>
                          ) : null}
                          {chat.unreadCount && chat.unreadCount > 0 ? (
                            <span className="chat-badge">{chat.unreadCount}</span>
                          ) : null}
                        </div>
                      </div>
                    </motion.button>
                  )
                })
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </motion.div>

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
                  setActiveUserMenuScope(null)
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
            onClick={() =>
              setActiveUserMenuScope((current) => (current === userMenuScope ? null : userMenuScope))
            }
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
    </motion.aside>
  )
}
