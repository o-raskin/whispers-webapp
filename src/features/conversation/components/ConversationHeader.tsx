import { motion } from 'framer-motion'
import type { ChatThread } from '../../../shared/types/chat'
import { itemReveal, springTransition } from '../../../shared/motion/presets'
import { getInitials } from './conversationPanelShared'
import './conversation-header.css'

interface ConversationHeaderProps {
  callButtonLabel: string
  conversationTitle: string
  isActiveCallPhase: boolean
  isCallButtonDisabled: boolean
  isMobileLayout: boolean
  isRecipientOnline: boolean
  isRemoteTyping: boolean
  pendingParticipant: string | null
  subtitle: string
  thread: ChatThread | null
  onBackToInbox: () => void
  onCallButtonClick: () => void
}

export function ConversationHeader({
  callButtonLabel,
  conversationTitle,
  isActiveCallPhase,
  isCallButtonDisabled,
  isMobileLayout,
  isRecipientOnline,
  isRemoteTyping,
  pendingParticipant,
  subtitle,
  thread,
  onBackToInbox,
  onCallButtonClick,
}: ConversationHeaderProps) {
  return (
    <motion.div className="conversation-header" variants={itemReveal}>
      <div className="conversation-persona">
        {thread && isMobileLayout ? (
          <motion.button
            className="conversation-mobile-back"
            type="button"
            onClick={onBackToInbox}
            aria-label="Back to inbox"
            whileHover={{ y: -1, scale: 1.01 }}
            whileTap={{ scale: 0.96 }}
            transition={springTransition}
          >
            <svg
              className="conversation-mobile-back-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path
                className="conversation-mobile-back-icon-stroke"
                d="M14.5 5.5 8 12l6.5 6.5"
              />
            </svg>
          </motion.button>
        ) : null}
        <motion.div
          className={`conversation-avatar ${isRecipientOnline ? 'online' : ''}`}
          whileHover={{ scale: 1.03, rotate: -4 }}
          transition={springTransition}
        >
          {thread
            ? getInitials(thread.participant)
            : pendingParticipant
              ? getInitials(pendingParticipant)
              : 'W'}
        </motion.div>
        <div className="conversation-copy">
          <h2>{conversationTitle}</h2>
          <div className="conversation-subtitle">
            {isRemoteTyping ? (
              <span className="conversation-typing-status" aria-live="polite">
                <span className="typing-dots conversation-typing-dots" aria-hidden="true">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </span>
                <span>typing</span>
              </span>
            ) : (
              subtitle
            )}
          </div>
        </div>
      </div>
      <div className="conversation-actions">
        <motion.button
          className={`conversation-call-button ${isActiveCallPhase ? 'is-live' : ''}`}
          type="button"
          aria-label={callButtonLabel}
          disabled={isCallButtonDisabled}
          whileHover={isCallButtonDisabled ? undefined : { y: -1, scale: 1.01 }}
          whileTap={isCallButtonDisabled ? undefined : { scale: 0.97 }}
          transition={springTransition}
          onClick={onCallButtonClick}
        >
          <svg
            className="conversation-call-button-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path
              className="conversation-call-button-icon-stroke"
              d="M8.2 5.6a1 1 0 0 1 1.1-.4l2.3.8a1 1 0 0 1 .7 1.2l-.6 2.1a1.7 1.7 0 0 0 .4 1.6l1.1 1.1c.4.4 1 .6 1.6.4l2.1-.6a1 1 0 0 1 1.2.7l.8 2.3a1 1 0 0 1-.4 1.1 6.7 6.7 0 0 1-4.4.8A12.6 12.6 0 0 1 5.8 8.9a6.7 6.7 0 0 1 .8-3.3Z"
            />
          </svg>
        </motion.button>
        <div className="conversation-summary">
          <div className="conversation-stat">
            {thread ? `${thread.messages.length} messages synced` : 'Realtime shell ready'}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
