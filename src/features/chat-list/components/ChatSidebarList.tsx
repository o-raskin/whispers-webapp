import { AnimatePresence, motion } from 'framer-motion'
import type { RefObject } from 'react'
import type { ChatSummary, ConnectionStatus, UserPresence } from '../../../shared/types/chat'
import {
  itemReveal,
  listStagger,
  panelTransition,
} from '../../../shared/motion/presets'
import { formatChatListTimestamp, isUserOnline } from '../../../shared/utils/presence'
import { getChatDisplayName, getInitials } from './chatSidebarShared'
import './chat-sidebar-list.css'

interface ChatSidebarListProps {
  chats: ChatSummary[]
  selectedChatId: string | null
  sidebarFadeState: {
    showBottomFade: boolean
    showTopFade: boolean
  }
  sidebarScrollRef: RefObject<HTMLDivElement | null>
  status: ConnectionStatus
  users: Record<string, UserPresence>
  onSelectChat: (chatId: string) => void
  onScroll: () => void
}

export function ChatSidebarList({
  chats,
  selectedChatId,
  sidebarFadeState,
  sidebarScrollRef,
  status,
  users,
  onSelectChat,
  onScroll,
}: ChatSidebarListProps) {
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
                const preview = chat.preview || (
                  isPrivateChat
                    ? 'Encrypted messages stay readable only in this browser.'
                    : 'No messages yet.'
                )

                return (
                  <motion.button
                    key={chat.chatId}
                    className={`chat-item ${isActive ? 'active' : ''} ${isPrivateChat ? 'private' : ''}`}
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
                )
              })
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
