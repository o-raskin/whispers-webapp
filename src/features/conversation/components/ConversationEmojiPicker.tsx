import { motion } from 'framer-motion'
import { panelTransition } from '../../../shared/motion/presets'
import { EMOJI_CHOICES } from './conversationPanelShared'

interface ConversationEmojiPickerProps {
  isMobileLayout: boolean
  onClose: () => void
  onSelectEmoji: (emoji: string) => void
}

export function ConversationEmojiPicker({
  isMobileLayout,
  onClose,
  onSelectEmoji,
}: ConversationEmojiPickerProps) {
  return (
    <motion.div
      className={`emoji-picker-popover ${isMobileLayout ? 'emoji-picker-popover--mobile' : ''}`}
      initial={{ opacity: 0, y: 10, scale: 0.96, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: 8, scale: 0.97, filter: 'blur(6px)' }}
      transition={panelTransition}
      onClick={isMobileLayout ? (event) => event.stopPropagation() : undefined}
      role={isMobileLayout ? 'dialog' : undefined}
      aria-modal={isMobileLayout ? 'true' : undefined}
      aria-label={isMobileLayout ? 'Emoji picker' : undefined}
    >
      <div className="emoji-picker-header">
        <span>Emoji</span>
        <button
          className="emoji-picker-close"
          type="button"
          onClick={onClose}
          aria-label="Close emoji picker"
        >
          ×
        </button>
      </div>
      <div className="emoji-picker-grid" role="listbox" aria-label="Emoji choices">
        {EMOJI_CHOICES.map((emoji) => (
          <button
            key={emoji}
            className="emoji-picker-option"
            type="button"
            onClick={() => onSelectEmoji(emoji)}
            aria-label={`Insert ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </motion.div>
  )
}
