import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { ChatSummary, ConnectionStatus, UserPresence } from '../../../shared/types/chat'
import {
  itemReveal,
  listStagger,
  panelTransition,
} from '../../../shared/motion/presets'
import { formatChatListTimestamp, isUserOnline } from '../../../shared/utils/presence'
import { getChatDisplayName, getInitials } from './chatSidebarShared'
import './chat-sidebar-list.css'

const CHAT_ACTION_PRESS_MS = 700

interface ChatSidebarListProps {
  chats: ChatSummary[]
  currentUserId: string
  selectedChatId: string | null
  sidebarFadeState: {
    showBottomFade: boolean
    showTopFade: boolean
  }
  sidebarScrollRef: RefObject<HTMLDivElement | null>
  status: ConnectionStatus
  users: Record<string, UserPresence>
  onDeleteChat: (chatId: string) => void
  onSelectChat: (chatId: string) => void
  onScroll: () => void
}

function canShowDeleteAction(chat: ChatSummary, currentUserId: string) {
  if ((chat.type ?? 'DIRECT') !== 'GROUP') {
    return true
  }

  const creatorUserId = chat.creatorUserId?.trim().toLowerCase()
  const normalizedCurrentUserId = currentUserId.trim().toLowerCase()

  return Boolean(creatorUserId && normalizedCurrentUserId && creatorUserId === normalizedCurrentUserId)
}

export function ChatSidebarList({
  chats,
  currentUserId,
  selectedChatId,
  sidebarFadeState,
  sidebarScrollRef,
  status,
  users,
  onDeleteChat,
  onSelectChat,
  onScroll,
}: ChatSidebarListProps) {
  const [activeActionChatId, setActiveActionChatId] = useState<string | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const suppressNextSelectRef = useRef<string | null>(null)

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  useEffect(() => {
    if (!activeActionChatId) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (!(target instanceof Element)) {
        return
      }

      if (target.closest('.chat-item-action-root')) {
        return
      }

      setActiveActionChatId(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveActionChatId(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeActionChatId])

  useEffect(() => () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
    }
  }, [])

  return (
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
        onScroll={onScroll}
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
                const isOnline = isUserOnline(users[chat.username])
                const isPrivateChat = (chat.type ?? 'DIRECT') === 'PRIVATE'
                const lastMessageTime = formatChatListTimestamp(chat.lastMessageTimestamp)
                const displayName = getChatDisplayName(chat)
                const isActionMenuOpen = activeActionChatId === chat.chatId
                const canDelete = canShowDeleteAction(chat, currentUserId)
                const preview = chat.preview || (
                  isPrivateChat
                    ? 'Encrypted messages stay readable only in this browser.'
                    : 'No messages yet.'
                )

                return (
                  <motion.div
                    key={chat.chatId}
                    className="chat-item-action-root"
                    layout
                    variants={itemReveal}
                    initial="hidden"
                    animate="visible"
                    exit={{
                      opacity: 0,
                      x: 22,
                      y: -8,
                      scale: 0.96,
                      rotate: 1.6,
                      filter: 'blur(12px)',
                    }}
                    transition={{
                      ...panelTransition,
                      delay: index * 0.02,
                    }}
                  >
                    <motion.button
                      className={`chat-item ${isActive ? 'active' : ''} ${isPrivateChat ? 'private' : ''} ${isActionMenuOpen ? 'has-action-menu' : ''}`}
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={isActionMenuOpen}
                      aria-controls={`chat-actions-${chat.chatId}`}
                      onPointerDown={(event) => {
                        if (event.button !== 0) {
                          return
                        }

                        clearLongPressTimer()
                        longPressTimerRef.current = window.setTimeout(() => {
                          suppressNextSelectRef.current = chat.chatId
                          setActiveActionChatId(chat.chatId)
                        }, CHAT_ACTION_PRESS_MS)
                      }}
                      onPointerUp={clearLongPressTimer}
                      onPointerCancel={clearLongPressTimer}
                      onPointerLeave={clearLongPressTimer}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        clearLongPressTimer()
                        suppressNextSelectRef.current = chat.chatId
                        setActiveActionChatId(chat.chatId)
                      }}
                      onClick={(event) => {
                        if (suppressNextSelectRef.current === chat.chatId) {
                          event.preventDefault()
                          suppressNextSelectRef.current = null
                          return
                        }

                        onSelectChat(chat.chatId)
                      }}
                      whileTap={{ scale: 0.992 }}
                      transition={panelTransition}
                    >
                      {isActive ? (
                        <motion.div
                          className="chat-item-glow"
                          layoutId="active-chat-card"
                          transition={panelTransition}
                        />
                      ) : null}
                      <div className="chat-item-top">
                        <div className={`chat-avatar ${isOnline ? 'online' : ''}`}>
                          {chat.profileUrl ? (
                            <img
                              className="chat-avatar-image"
                              src={chat.profileUrl}
                              alt={displayName}
                            />
                          ) : (
                            getInitials(displayName)
                          )}
                        </div>
                        <div className="chat-item-title-row">
                          <div className="chat-item-title">{displayName}</div>
                          {isPrivateChat ? (
                            <span className="chat-item-chip">Private</span>
                          ) : null}
                        </div>
                        <div className="chat-item-preview">
                          {preview}
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

                    <AnimatePresence>
                      {isActionMenuOpen ? (
                        <motion.div
                          className="chat-action-menu"
                          id={`chat-actions-${chat.chatId}`}
                          role="menu"
                          aria-label={`${displayName} actions`}
                          initial={{ opacity: 0, y: -6, scale: 0.94, filter: 'blur(8px)' }}
                          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                          exit={{ opacity: 0, y: -4, scale: 0.96, filter: 'blur(6px)' }}
                          transition={panelTransition}
                        >
                          <button
                            className="chat-action-menu-item danger"
                            type="button"
                            role="menuitem"
                            disabled={!canDelete}
                            onClick={() => {
                              if (!canDelete) {
                                return
                              }

                              setActiveActionChatId(null)
                              onDeleteChat(chat.chatId)
                            }}
                          >
                            Delete
                          </button>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </motion.div>
                )
              })
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
