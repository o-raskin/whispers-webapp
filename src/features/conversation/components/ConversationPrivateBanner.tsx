import { motion } from 'framer-motion'
import { itemReveal, springTransition } from '../../../shared/motion/presets'
import './conversation-private-banner.css'

interface PrivateChatState {
  accessState: 'idle' | 'loading' | 'ready' | 'missing-key' | 'setting-up' | 'error'
  notice: string | null
}

interface ConversationPrivateBannerProps {
  isPrivateChat: boolean
  privateChatState: PrivateChatState | null
  onSetUpPrivateChatBrowser: () => void
}

export function ConversationPrivateBanner({
  isPrivateChat,
  privateChatState,
  onSetUpPrivateChatBrowser,
}: ConversationPrivateBannerProps) {
  if (!isPrivateChat) {
    return null
  }

  const accessState = privateChatState?.accessState ?? 'idle'
  const notice =
    privateChatState?.notice ??
    'Private messages are end-to-end encrypted and stay readable only in this browser.'
  const shouldShowSetupAction = accessState === 'missing-key'

  return (
    <motion.div
      className={`conversation-private-banner is-${accessState}`}
      variants={itemReveal}
    >
      <div className="conversation-private-banner__copy">
        <span className="conversation-private-banner__eyebrow">Private chat</span>
        <p>{notice}</p>
      </div>
      {shouldShowSetupAction ? (
        <motion.button
          className="conversation-private-banner__action"
          type="button"
          onClick={onSetUpPrivateChatBrowser}
          whileHover={{ y: -1, scale: 1.01 }}
          whileTap={{ scale: 0.985 }}
          transition={springTransition}
        >
          Set up this browser
        </motion.button>
      ) : null}
    </motion.div>
  )
}
