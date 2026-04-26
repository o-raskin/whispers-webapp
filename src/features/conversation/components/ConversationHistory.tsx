import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import type { ChatMessage, ChatThread } from '../../../shared/types/chat'
import {
  itemReveal,
  listStagger,
  panelTransition,
} from '../../../shared/motion/presets'
import { formatTimestamp } from '../../../shared/utils/presence'
import './conversation-history.css'

const MESSAGE_ACTION_LONG_PRESS_MS = 700
const MESSAGE_ACTION_MOVE_TOLERANCE_PX = 10

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
  isHistoryAtBottom: boolean
  isMobileLayout: boolean
  onHistoryAnimationComplete: () => void
  onDeleteMessage?: (messageId: string) => void
  onEditMessage?: (message: { chatId: string; messageId: string; text: string }) => void
  onScrollToLatest: (behavior?: ScrollBehavior) => void
  participantProfile: ParticipantProfile | null
  showHistoryLoadingState: boolean
  thread: ChatThread | null
  visibleHistoryFadeState: {
    showBottomFade: boolean
    showTopFade: boolean
  }
}

interface MessageActionMenuState {
  chatId: string
  left: number
  messageId: string
  text: string
  top: number
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
  isHistoryAtBottom,
  isMobileLayout,
  onHistoryAnimationComplete,
  onDeleteMessage,
  onEditMessage,
  onScrollToLatest,
  participantProfile,
  showHistoryLoadingState,
  thread,
  visibleHistoryFadeState,
}: ConversationHistoryProps) {
  const longPressTimerRef = useRef<number | null>(null)
  const longPressOriginRef = useRef<{ x: number; y: number } | null>(null)
  const [messageActionMenu, setMessageActionMenu] = useState<MessageActionMenuState | null>(null)
  const participantMessageLabel = getParticipantMessageLabel(
    participantProfile,
    thread?.participant ?? 'Someone',
  )
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    longPressOriginRef.current = null
  }, [])
  const closeMessageActionMenu = useCallback(() => {
    setMessageActionMenu(null)
  }, [])
  const isMessageActionAvailable = useCallback((message: ChatMessage) => (
    Boolean(
      message.messageId &&
      message.senderUserId === currentUserId &&
      (onDeleteMessage || onEditMessage),
    )
  ), [currentUserId, onDeleteMessage, onEditMessage])
  const openMessageActionMenu = useCallback((
    message: ChatMessage,
    event: Pick<ReactPointerEvent<HTMLElement>, 'clientX' | 'clientY'>,
  ) => {
    if (!isMessageActionAvailable(message) || !message.messageId) {
      return
    }

    setMessageActionMenu({
      chatId: message.chatId,
      left: event.clientX,
      messageId: message.messageId,
      text: message.text,
      top: event.clientY,
    })
  }, [isMessageActionAvailable])
  const handleMessagePointerDown = useCallback((
    message: ChatMessage,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (!isMessageActionAvailable(message) || event.button !== 0) {
      return
    }

    clearLongPressTimer()
    closeMessageActionMenu()
    longPressOriginRef.current = {
      x: event.clientX,
      y: event.clientY,
    }
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null
      longPressOriginRef.current = null
      openMessageActionMenu(message, event)
    }, MESSAGE_ACTION_LONG_PRESS_MS)
  }, [
    clearLongPressTimer,
    closeMessageActionMenu,
    isMessageActionAvailable,
    openMessageActionMenu,
  ])
  const handleMessagePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const origin = longPressOriginRef.current

    if (!origin) {
      return
    }

    const movedX = Math.abs(event.clientX - origin.x)
    const movedY = Math.abs(event.clientY - origin.y)

    if (movedX > MESSAGE_ACTION_MOVE_TOLERANCE_PX || movedY > MESSAGE_ACTION_MOVE_TOLERANCE_PX) {
      clearLongPressTimer()
    }
  }, [clearLongPressTimer])

  useEffect(() => () => {
    clearLongPressTimer()
  }, [clearLongPressTimer])

  useEffect(() => {
    if (!messageActionMenu) {
      return undefined
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMessageActionMenu()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeMessageActionMenu, messageActionMenu])

  const messageActionMenuPortal =
    typeof document !== 'undefined' && messageActionMenu
      ? createPortal(
          <AnimatePresence>
            <motion.div
              key="message-action-backdrop"
              className="message-action-backdrop"
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={panelTransition}
              onPointerDown={closeMessageActionMenu}
            />
            <motion.div
              key="message-action-menu"
              className="message-action-menu"
              role="menu"
              aria-label="Message actions"
              style={{
                '--message-action-menu-left': `${messageActionMenu.left}px`,
                '--message-action-menu-top': `${messageActionMenu.top}px`,
              } as CSSProperties}
              initial={{ opacity: 0, y: 8, scale: 0.92, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 8, scale: 0.94, filter: 'blur(8px)' }}
              transition={panelTransition}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {onEditMessage ? (
                <button
                  className="message-action-menu-item edit"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onEditMessage({
                      chatId: messageActionMenu.chatId,
                      messageId: messageActionMenu.messageId,
                      text: messageActionMenu.text,
                    })
                    closeMessageActionMenu()
                  }}
                >
                  Edit
                </button>
              ) : null}
              {onDeleteMessage ? (
                <button
                  className="message-action-menu-item delete"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onDeleteMessage(messageActionMenu.messageId)
                    closeMessageActionMenu()
                  }}
                >
                  Delete
                </button>
              ) : null}
            </motion.div>
          </AnimatePresence>,
          document.body,
        )
      : null

  return (
    <>
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
            {thread && !showHistoryLoadingState && isHistoryAnchored && !isHistoryAtBottom ? (
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
                            data-message-actionable={isMessageActionAvailable(message) ? 'true' : undefined}
                            layout
                            variants={itemReveal}
                            initial={isMobileLayout ? false : 'hidden'}
                            animate="visible"
                            exit={{
                              opacity: 0,
                              y: -18,
                              scale: 0.82,
                              rotate: message.direction === 'sent' ? 3 : -3,
                              filter: 'blur(7px)',
                            }}
                            transition={panelTransition}
                            onContextMenu={(event) => {
                              if (!isMessageActionAvailable(message)) {
                                return
                              }

                              event.preventDefault()
                              openMessageActionMenu(message, event)
                            }}
                            onPointerCancel={clearLongPressTimer}
                            onPointerDown={(event) => handleMessagePointerDown(message, event)}
                            onPointerMove={handleMessagePointerMove}
                            onPointerUp={clearLongPressTimer}
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
                            <motion.span
                              key={`${message.id}-${message.text}`}
                              className="message-body"
                              initial={{ opacity: 0, y: 4, filter: 'blur(4px)' }}
                              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                              transition={panelTransition}
                            >
                              {message.text}
                            </motion.span>
                            {message.direction !== 'system' ? (
                              <span className="message-timestamp-row">
                                {message.updatedAt ? (
                                  <motion.span
                                    key={`${message.id}-edited-${message.updatedAt}`}
                                    className="message-edited-label"
                                    initial={{ opacity: 0, y: 3 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={panelTransition}
                                  >
                                    edited
                                  </motion.span>
                                ) : null}
                                <span className="message-timestamp">
                                  {formatTimestamp(message.timestamp)}
                                </span>
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
      {messageActionMenuPortal}
    </>
  )
}
