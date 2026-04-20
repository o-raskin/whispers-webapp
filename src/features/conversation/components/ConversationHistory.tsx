import { AnimatePresence, motion } from 'framer-motion'
import type { RefObject } from 'react'
import type { ChatThread } from '../../../shared/types/chat'
import {
  itemReveal,
  listStagger,
  panelTransition,
} from '../../../shared/motion/presets'
import { formatTimestamp } from '../../../shared/utils/presence'
import './conversation-history.css'

interface ParticipantProfile {
  firstName?: string | null
  lastName?: string | null
  username: string
}

interface ConversationHistoryProps {
  currentUserId: string
  handleHistoryBottomAnchorRef: (node: HTMLDivElement | null) => void
  historyRef: RefObject<HTMLDivElement | null>
  isHistoryAnchored: boolean
  isMobileLayout: boolean
  onHistoryAnimationComplete: () => void
  onScrollToLatest: (behavior?: ScrollBehavior) => void
  participantProfile: ParticipantProfile | null
  showHistoryLoadingState: boolean
  thread: ChatThread | null
  visibleHistoryFadeState: {
    showBottomFade: boolean
    showTopFade: boolean
  }
}

function getParticipantMessageLabel(participantProfile: ParticipantProfile | null, fallback: string) {
  const fullName = [participantProfile?.firstName?.trim(), participantProfile?.lastName?.trim()]
    .filter(Boolean)
    .join(' ')

  return fullName || participantProfile?.username || fallback
}

export function ConversationHistory({
  currentUserId,
  handleHistoryBottomAnchorRef,
  historyRef,
  isHistoryAnchored,
  isMobileLayout,
  onHistoryAnimationComplete,
  onScrollToLatest,
  participantProfile,
  showHistoryLoadingState,
  thread,
  visibleHistoryFadeState,
}: ConversationHistoryProps) {
  const participantMessageLabel = getParticipantMessageLabel(
    participantProfile,
    thread?.participant ?? 'Someone',
  )

  return (
    <motion.div className="history-shell" variants={itemReveal}>
      <div className="history-viewport">
        <div
          className={`history-edge-fade top ${visibleHistoryFadeState.showTopFade ? 'visible' : ''}`}
          aria-hidden="true"
        />
        <div
          className={`history-edge-fade bottom ${visibleHistoryFadeState.showBottomFade ? 'visible' : ''}`}
          aria-hidden="true"
        />
        <AnimatePresence>
          {thread && !showHistoryLoadingState && isHistoryAnchored && visibleHistoryFadeState.showBottomFade ? (
            <motion.button
              key="history-scroll-button"
              className="history-scroll-button"
              type="button"
              aria-label="Scroll to latest message"
              initial={{ opacity: 0, y: 10, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.94 }}
              transition={panelTransition}
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onScrollToLatest('smooth')}
            >
              <svg
                className="history-scroll-button-icon"
                viewBox="0 0 16 16"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M3.5 6.25 8 10.75l4.5-4.5" />
              </svg>
            </motion.button>
          ) : null}
        </AnimatePresence>
        <div
          className={`history ${thread && !showHistoryLoadingState && !isHistoryAnchored ? 'is-anchoring' : ''}`}
          ref={historyRef}
        >
          <div className={`history-content ${thread && !showHistoryLoadingState ? 'has-thread' : ''}`}>
            <AnimatePresence initial={false}>
              {showHistoryLoadingState ? (
                <motion.div
                  key="history-loading"
                  className="history-loading"
                  aria-label="Loading conversation"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={panelTransition}
                >
                  <div className="message-skeleton received" />
                  <div className="message-skeleton sent" />
                  <div className="message-skeleton received short" />
                </motion.div>
              ) : thread ? (
                <motion.div
                  key={thread.chatId}
                  className="message-column"
                  variants={listStagger}
                  initial={isMobileLayout ? false : 'hidden'}
                  animate="visible"
                  exit={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
                  onAnimationComplete={onHistoryAnimationComplete}
                >
                  <AnimatePresence initial={false}>
                    {thread.messages.map((message, index) => {
                      const previous = thread.messages[index - 1]
                      const showMeta =
                        !previous ||
                        previous.senderUserId !== message.senderUserId ||
                        previous.direction !== message.direction
                      const privateEncryptionStateClass =
                        message.encryption?.mode === 'PRIVATE'
                          ? `private-${message.encryption.state}`
                          : ''

                      return (
                        <motion.article
                          key={message.id}
                          className={`message ${message.direction} ${showMeta ? '' : 'stacked'} ${privateEncryptionStateClass}`}
                          layout
                          variants={itemReveal}
                          initial={isMobileLayout ? false : 'hidden'}
                          animate="visible"
                          exit={{ opacity: 0, y: 10, scale: 0.98 }}
                          transition={panelTransition}
                        >
                          {showMeta ? (
                            <div className="message-meta-row">
                              <span className="message-meta">
                                {message.senderUserId === currentUserId
                                  ? 'You'
                                  : participantMessageLabel}
                              </span>
                              {message.encryption?.mode === 'PRIVATE' ? (
                                <span className="message-private-chip">
                                  {message.encryption.state === 'decrypted'
                                    ? 'Private'
                                    : 'Locked'}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                          <span className="message-body">{message.text}</span>
                          {message.direction !== 'system' ? (
                            <span className="message-timestamp">
                              {formatTimestamp(message.timestamp)}
                            </span>
                          ) : null}
                        </motion.article>
                      )
                    })}
                  </AnimatePresence>
                  <div
                    className="history-bottom-anchor"
                    ref={handleHistoryBottomAnchorRef}
                    aria-hidden="true"
                  />
                </motion.div>
              ) : isMobileLayout ? (
                <motion.div
                  key="history-mobile-idle"
                  className="history-loading"
                  aria-label="Loading conversation"
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={panelTransition}
                >
                  <div className="message-skeleton received" />
                  <div className="message-skeleton sent" />
                  <div className="message-skeleton received short" />
                </motion.div>
              ) : (
                <motion.div
                  key="history-welcome"
                  className="welcome-panel"
                  initial={{ opacity: 0, y: 18, filter: 'blur(12px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={
                    isMobileLayout
                      ? { opacity: 0, y: -4, filter: 'blur(0px)' }
                      : { opacity: 0, y: -12, filter: 'blur(8px)' }
                  }
                  transition={panelTransition}
                >
                  <div className="welcome-panel-mark" aria-hidden="true">
                    W
                  </div>
                  <div className="welcome-panel-title">Your conversation space is ready.</div>
                  <div className="welcome-panel-copy">
                    Connect to the backend, pick a conversation, and the live thread will
                    bloom here with message history, presence updates, and new activity.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
