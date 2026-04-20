import { motion } from 'framer-motion'
import type { ChangeEvent } from 'react'
import { itemReveal, springTransition } from '../../../shared/motion/presets'
import './chat-sidebar-create-chat.css'

interface ChatSidebarCreateChatProps {
  isPrivateChatAvailable: boolean
  newChatUserId: string
  onCreateDirectChat: () => void
  onCreatePrivateChat: () => void
  onNewChatUserIdChange: (value: string) => void
}

export function ChatSidebarCreateChat({
  isPrivateChatAvailable,
  newChatUserId,
  onCreateDirectChat,
  onCreatePrivateChat,
  onNewChatUserIdChange,
}: ChatSidebarCreateChatProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onNewChatUserIdChange(event.target.value)
  }

  return (
    <motion.div className="create-chat-card" variants={itemReveal}>
      <div className="create-chat-copy">
        <div className="create-chat-eyebrow">New conversation</div>
        <div className="create-chat-note">
          Choose a standard chat or a PRIVATE one tied to this browser.
        </div>
      </div>
      <div className="create-chat">
        <input
          id="newChatUserId"
          placeholder="username or email"
          aria-label="Search user to start a new chat"
          value={newChatUserId}
          onChange={handleChange}
        />
        <div className="create-chat-actions">
          <motion.button
            className="create-chat-button"
            type="button"
            aria-label="Start direct chat"
            onClick={onCreateDirectChat}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            transition={springTransition}
          >
            Chat
          </motion.button>
          <motion.button
            className="create-chat-button create-chat-button--private"
            type="button"
            aria-label="Start private chat"
            disabled={!isPrivateChatAvailable}
            onClick={onCreatePrivateChat}
            whileHover={
              !isPrivateChatAvailable ? undefined : { y: -2, scale: 1.01 }
            }
            whileTap={!isPrivateChatAvailable ? undefined : { scale: 0.985 }}
            transition={springTransition}
          >
            Private
          </motion.button>
        </div>
      </div>
      <div
        className={`create-chat-footnote ${isPrivateChatAvailable ? '' : 'is-warning'}`}
      >
        {isPrivateChatAvailable
          ? 'Private chats are end-to-end encrypted and stay readable only in this browser.'
          : 'Private chats need a modern secure browser on this device.'}
      </div>
    </motion.div>
  )
}
