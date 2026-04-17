import { motion } from 'framer-motion'
import { useState } from 'react'
import type { ConnectionStatus } from '../../../shared/types/chat'
import type { ChatSummary, UserPresence } from '../../../shared/types/chat'
import { sectionReveal } from '../../../shared/motion/presets'
import { ChatSidebarAccount } from './ChatSidebarAccount'
import { ChatSidebarCreateChat } from './ChatSidebarCreateChat'
import { ChatSidebarHeader } from './ChatSidebarHeader'
import { ChatSidebarList } from './ChatSidebarList'
import { useSidebarScrollFades } from '../hooks/useSidebarScrollFades'
import { useSidebarUserMenu } from '../hooks/useSidebarUserMenu'
import './chat-sidebar.css'

export interface ChatSidebarProps {
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
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const currentUserLabel = currentUserId.trim() || 'Guest'
  const { sidebarFadeState, sidebarScrollRef, updateSidebarFadeState } =
    useSidebarScrollFades({
      chatsLength: chats.length,
      isInfoOpen,
      status,
    })
  const { closeUserMenu, isUserMenuOpen, toggleUserMenu, userMenuRef } =
    useSidebarUserMenu({
      currentUserLabel,
      status,
    })

  return (
    <motion.aside className="sidebar" variants={sectionReveal}>
      <ChatSidebarHeader
        isInfoOpen={isInfoOpen}
        onToggleInfo={() => setIsInfoOpen((current) => !current)}
      />

      <ChatSidebarCreateChat
        newChatUserId={newChatUserId}
        onCreateChat={onCreateChat}
        onNewChatUserIdChange={onNewChatUserIdChange}
      />

      <ChatSidebarList
        chats={chats}
        selectedChatId={selectedChatId}
        sidebarFadeState={sidebarFadeState}
        sidebarScrollRef={sidebarScrollRef}
        status={status}
        users={users}
        onSelectChat={onSelectChat}
        onScroll={updateSidebarFadeState}
      />

      <ChatSidebarAccount
        currentUserLabel={currentUserLabel}
        isUserMenuOpen={isUserMenuOpen}
        userMenuRef={userMenuRef}
        onDisconnect={onDisconnect}
        onToggleUserMenu={toggleUserMenu}
        onCloseUserMenu={closeUserMenu}
      />
    </motion.aside>
  )
}
