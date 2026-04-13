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
}: ChatSidebarProps) {
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null)
  const [isInfoOpen, setIsInfoOpen] = useState(false)
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

      <motion.div className="sidebar-user-card" variants={itemReveal}>
        <div className="sidebar-user-avatar">{getInitials(currentUserLabel)}</div>
        <div className="sidebar-user-copy">
          <span className="sidebar-user-label">Signed in as</span>
          <strong>{currentUserLabel}</strong>
        </div>
      </motion.div>
    </motion.aside>
  )
}
