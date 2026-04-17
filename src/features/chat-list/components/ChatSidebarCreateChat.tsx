import { motion } from 'framer-motion'
import type { ChangeEvent } from 'react'
import { itemReveal, springTransition } from '../../../shared/motion/presets'

interface ChatSidebarCreateChatProps {
  newChatUserId: string
  onCreateChat: () => void
  onNewChatUserIdChange: (value: string) => void
}

export function ChatSidebarCreateChat({
  newChatUserId,
  onCreateChat,
  onNewChatUserIdChange,
}: ChatSidebarCreateChatProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onNewChatUserIdChange(event.target.value)
  }

  return (
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
  )
}
