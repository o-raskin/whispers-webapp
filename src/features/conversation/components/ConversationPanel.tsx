import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { ChangeEvent, KeyboardEvent } from 'react'
import type { ConnectionStatus } from '../../../shared/types/chat'
import type { CallPhase, ChatThread, UserPresence } from '../../../shared/types/chat'
import {
  itemReveal,
  listStagger,
  panelTransition,
  sectionReveal,
  springTransition,
} from '../../../shared/motion/presets'
import {
  formatPresenceLabel,
  formatTimestamp,
  isUserOnline,
} from '../../../shared/utils/presence'

const EMOJI_CHOICES = [
  '😀',
  '😁',
  '😂',
  '🙂',
  '😉',
  '😊',
  '😍',
  '😘',
  '🤔',
  '😎',
  '🥳',
  '😴',
  '😭',
  '😡',
  '🤝',
  '🙏',
  '👍',
  '👎',
  '👏',
  '🔥',
  '✨',
  '💡',
  '❤️',
  '💙',
  '💬',
  '🎉',
  '🚀',
  '🌙',
]

interface ConversationPanelProps {
  thread: ChatThread | null
  pendingParticipantName?: string | null
  user: UserPresence | null
  currentUserId: string
  isMobileLayout: boolean
  connectionStatus: ConnectionStatus
  isHistoryLoading: boolean
  isDrafting: boolean
  remoteTypingLabel: string | null
  callPhase: CallPhase
  localCallStream: MediaStream | null
  remoteCallStream: MediaStream | null
  messageDraft: string
  onMessageDraftChange: (value: string) => void
  onBackToInbox: () => void
  onAcceptCall: () => void
  onDeclineCall: () => void
  onEndCall: () => void
  onSendMessage: () => void
  onStartCall: () => void
}

export function ConversationPanel({
  thread,
  pendingParticipantName = null,
  user,
  currentUserId,
  isMobileLayout,
  connectionStatus,
  isHistoryLoading,
  isDrafting,
  remoteTypingLabel,
  callPhase,
  localCallStream,
  remoteCallStream,
  messageDraft,
  onMessageDraftChange,
  onBackToInbox,
  onAcceptCall,
  onDeclineCall,
  onEndCall,
  onSendMessage,
  onStartCall,
}: ConversationPanelProps) {
  const historyRef = useRef<HTMLDivElement | null>(null)
  const historyBottomRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const localAudioRef = useRef<HTMLAudioElement | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const previousChatIdRef = useRef<string | null>(null)
  const [isComposerFocused, setIsComposerFocused] = useState(false)
  const [isHistoryAnchored, setIsHistoryAnchored] = useState(false)
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const [historyFadeState, setHistoryFadeState] = useState({
    showTopFade: false,
    showBottomFade: false,
  })

  const scrollHistoryToLatest = useCallback((behavior: ScrollBehavior = 'auto') => {
    const historyElement = historyRef.current
    const bottomAnchor = historyBottomRef.current

    if (!historyElement) {
      return
    }

    historyElement.scrollTo({
      top: historyElement.scrollHeight,
      behavior,
    })
    bottomAnchor?.scrollIntoView({ block: 'end', behavior })
  }, [])

  const updateHistoryFadeState = useCallback(() => {
    const historyElement = historyRef.current

    if (!historyElement) {
      setHistoryFadeState({
        showTopFade: false,
        showBottomFade: false,
      })
      return
    }

    const { scrollTop, scrollHeight, clientHeight } = historyElement
    const maxScrollTop = Math.max(scrollHeight - clientHeight, 0)
    const threshold = 6
    const hasOverflow = maxScrollTop > threshold

    setHistoryFadeState({
      showTopFade: hasOverflow && scrollTop > threshold,
      showBottomFade: hasOverflow && scrollTop < maxScrollTop - threshold,
    })
  }, [])

  const handleHistoryBottomAnchorRef = useCallback((node: HTMLDivElement | null) => {
    historyBottomRef.current = node
  }, [])

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onMessageDraftChange(event.target.value)
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSendMessage()
    }
  }
  const handleSubmit = () => {
    onSendMessage()
  }
  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current

    if (!textarea) {
      onMessageDraftChange(`${messageDraft}${emoji}`)
      setIsEmojiPickerOpen(false)
      return
    }

    const selectionStart = textarea.selectionStart ?? messageDraft.length
    const selectionEnd = textarea.selectionEnd ?? messageDraft.length
    const nextValue =
      `${messageDraft.slice(0, selectionStart)}${emoji}${messageDraft.slice(selectionEnd)}`

    onMessageDraftChange(nextValue)
    setIsEmojiPickerOpen(false)

    window.requestAnimationFrame(() => {
      textarea.focus()
      const caretPosition = selectionStart + emoji.length
      textarea.setSelectionRange(caretPosition, caretPosition)
    })
  }
  const getInitials = (value: string) => value.slice(0, 2).toUpperCase()
  const isRecipientOnline = isUserOnline(user)
  const isRemoteTyping = Boolean(remoteTypingLabel)
  const closeEmojiPicker = () => {
    setIsEmojiPickerOpen(false)
  }
  const pendingParticipant = pendingParticipantName?.trim() || null
  const isMobilePendingThread = isMobileLayout && !thread && isHistoryLoading
  const hasVisibleThreadMessages = Boolean(thread?.messages.length)
  const showHistoryLoadingState = isHistoryLoading && !hasVisibleThreadMessages
  const callParticipantLabel = thread?.participant ?? pendingParticipant ?? 'your contact'
  const isIncomingCall = callPhase === 'incoming'
  const isActiveCallPhase =
    callPhase === 'outgoing' || callPhase === 'connecting' || callPhase === 'active'
  const conversationTitle = thread
    ? thread.participant
    : isMobilePendingThread
      ? pendingParticipant ?? 'Loading conversation'
      : 'Welcome to Whispers'

  const subtitle = thread
    ? isRecipientOnline
      ? 'Online'
      : `Last seen: ${formatPresenceLabel(user?.lastPingTime ?? null)}`
    : isMobilePendingThread
      ? 'Loading messages...'
    : 'No chat selected'
  const visibleHistoryFadeState =
    thread && !showHistoryLoadingState
      ? historyFadeState
      : {
          showTopFade: false,
          showBottomFade: false,
        }
  const callButtonLabel = isActiveCallPhase ? 'End audio call' : 'Start audio call'
  const isCallButtonDisabled =
    !thread ||
    connectionStatus !== 'connected' ||
    showHistoryLoadingState ||
    isIncomingCall

  useEffect(() => {
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = localCallStream
    }
  }, [localCallStream])

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteCallStream
    }
  }, [remoteCallStream])

  useLayoutEffect(() => {
    const currentChatId = thread?.chatId ?? null
    const previousChatId = previousChatIdRef.current
    const didChatChange = currentChatId !== previousChatId

    previousChatIdRef.current = currentChatId

    if (!currentChatId) {
      const frameId = window.requestAnimationFrame(() => {
        setIsHistoryAnchored(true)
      })

      return () => {
        window.cancelAnimationFrame(frameId)
      }
    }

    if (showHistoryLoadingState) {
      const frameId = window.requestAnimationFrame(() => {
        setIsHistoryAnchored(false)
      })

      return () => {
        window.cancelAnimationFrame(frameId)
      }
    }

    if (didChatChange) {
      const frameId = window.requestAnimationFrame(() => {
        setIsHistoryAnchored(false)
        scrollHistoryToLatest()
        updateHistoryFadeState()
      })

      return () => {
        window.cancelAnimationFrame(frameId)
      }
    }

    const frameId = window.requestAnimationFrame(() => {
      setIsHistoryAnchored(true)
      updateHistoryFadeState()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [showHistoryLoadingState, scrollHistoryToLatest, thread?.chatId, updateHistoryFadeState])

  useLayoutEffect(() => {
    if (showHistoryLoadingState || !thread) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      scrollHistoryToLatest()
      setIsHistoryAnchored(true)
      updateHistoryFadeState()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [
    thread?.messages.length,
    showHistoryLoadingState,
    scrollHistoryToLatest,
    thread,
    updateHistoryFadeState,
  ])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsEmojiPickerOpen(false)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [thread?.chatId])

  const emojiPicker = (
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
          onClick={closeEmojiPicker}
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
            onClick={() => handleEmojiSelect(emoji)}
            aria-label={`Insert ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </motion.div>
  )

  useEffect(() => {
    const historyElement = historyRef.current

    if (!historyElement) {
      return
    }

    const handleScroll = () => {
      updateHistoryFadeState()
    }

    historyElement.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            updateHistoryFadeState()
          })
        : null

    resizeObserver?.observe(historyElement)
    const historyContentElement = historyElement.querySelector('.history-content')

    if (historyContentElement instanceof HTMLElement) {
      resizeObserver?.observe(historyContentElement)
    }

    handleScroll()

    return () => {
      historyElement.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
      resizeObserver?.disconnect()
    }
  }, [thread?.chatId, updateHistoryFadeState])

  return (
    <motion.section className="conversation" variants={sectionReveal}>
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
            {thread ? getInitials(thread.participant) : pendingParticipant ? getInitials(pendingParticipant) : 'W'}
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
            onClick={isActiveCallPhase ? onEndCall : onStartCall}
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

      <AnimatePresence initial={false}>
        {callPhase !== 'idle' ? (
          <motion.div
            key={`call-banner-${callPhase}`}
            className="conversation-call-banner"
            initial={{ opacity: 0, y: -10, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
            transition={panelTransition}
          >
            <div className="conversation-call-copy">
              <div className="conversation-call-eyebrow">Audio call</div>
              <div className="conversation-call-title">
                {callPhase === 'incoming'
                  ? `${callParticipantLabel} is calling`
                  : callPhase === 'outgoing'
                    ? `Calling ${callParticipantLabel}...`
                    : callPhase === 'connecting'
                      ? `Connecting with ${callParticipantLabel}...`
                      : 'Call in progress'}
              </div>
            </div>
            <div className="conversation-call-actions">
              {callPhase === 'incoming' ? (
                <>
                  <motion.button
                    className="conversation-call-action"
                    type="button"
                    onClick={onAcceptCall}
                    whileHover={{ y: -1, scale: 1.01 }}
                    whileTap={{ scale: 0.97 }}
                    transition={springTransition}
                  >
                    Accept
                  </motion.button>
                  <motion.button
                    className="conversation-call-action secondary"
                    type="button"
                    onClick={() => onDeclineCall()}
                    whileHover={{ y: -1, scale: 1.01 }}
                    whileTap={{ scale: 0.97 }}
                    transition={springTransition}
                  >
                    Decline
                  </motion.button>
                </>
              ) : (
                <motion.button
                  className="conversation-call-action secondary"
                  type="button"
                  onClick={onEndCall}
                  whileHover={{ y: -1, scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  transition={springTransition}
                >
                  {callPhase === 'outgoing' ? 'Cancel' : 'Hang up'}
                </motion.button>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

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
                onClick={() => scrollHistoryToLatest('smooth')}
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
                    onAnimationComplete={() => {
                      scrollHistoryToLatest()
                      setIsHistoryAnchored(true)
                    }}
                  >
                    <AnimatePresence initial={false}>
                      {thread.messages.map((message, index) => {
                        const previous = thread.messages[index - 1]
                        const showMeta =
                          !previous ||
                          previous.senderUserId !== message.senderUserId ||
                          previous.direction !== message.direction

                        return (
                          <motion.article
                            key={message.id}
                            className={`message ${message.direction} ${showMeta ? '' : 'stacked'}`}
                            layout
                            variants={itemReveal}
                            initial={isMobileLayout ? false : 'hidden'}
                            animate="visible"
                            exit={{ opacity: 0, y: 10, scale: 0.98 }}
                            transition={panelTransition}
                          >
                            {showMeta ? (
                              <span className="message-meta">
                                {message.senderUserId === currentUserId ? 'You' : message.senderUserId}
                              </span>
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

      <motion.form
        className={`composer-panel ${isComposerFocused ? 'is-focused' : ''} ${isDrafting ? 'is-drafting' : ''}`}
        onSubmit={(event) => {
          event.preventDefault()
          handleSubmit()
        }}
        variants={itemReveal}
      >
        <motion.div
          className="composer-panel-halo"
          animate={{
            opacity: isComposerFocused || isDrafting ? 1 : 0.42,
            scale: isComposerFocused ? 1.02 : 1,
          }}
          transition={panelTransition}
        />
        <div className="composer">
          <div className="composer-input-row">
            <div className="composer-field-shell">
              <textarea
                id="messageText"
                ref={textareaRef}
                placeholder={
                  thread
                    ? `Send a message to ${thread.participant}`
                    : 'Choose a conversation to start typing'
                }
                value={messageDraft}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsComposerFocused(true)}
                onBlur={() => setIsComposerFocused(false)}
                enterKeyHint="send"
                rows={3}
                disabled={!thread}
              />
              <motion.button
                className={`composer-emoji-button ${isEmojiPickerOpen ? 'is-open' : ''}`}
                type="button"
                aria-label="Choose emoji"
                disabled={!thread}
                whileHover={!thread ? undefined : { y: -1, scale: 1.01 }}
                whileTap={!thread ? undefined : { scale: 0.97 }}
                transition={springTransition}
                onClick={() => {
                  if (!thread) {
                    return
                  }

                  setIsEmojiPickerOpen((current) => !current)
                  window.requestAnimationFrame(() => {
                    textareaRef.current?.focus()
                  })
                }}
              >
                <span className="composer-emoji-icon" aria-hidden="true">
                  ☺
                </span>
              </motion.button>
              <AnimatePresence>
                {isEmojiPickerOpen && thread && !isMobileLayout ? emojiPicker : null}
              </AnimatePresence>
            </div>
            <motion.button
              className="send-button"
              type="submit"
              aria-label="Send message"
              disabled={!thread || connectionStatus !== 'connected'}
              whileHover={
                !thread || connectionStatus !== 'connected'
                  ? undefined
                  : { y: -2, scale: 1.01 }
              }
              whileTap={
                !thread || connectionStatus !== 'connected' ? undefined : { scale: 0.985 }
              }
              transition={springTransition}
            >
              <svg
                className="send-button-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  className="send-button-icon-stroke"
                  d="M9.5 5.5 16 12l-6.5 6.5"
                />
              </svg>
            </motion.button>
          </div>
          <div className="composer-meta">
            <span>{thread ? 'Shift+Enter for newline' : 'Channel idle'}</span>
          </div>
        </div>
      </motion.form>

      <audio ref={localAudioRef} autoPlay playsInline muted className="conversation-audio" />
      <audio ref={remoteAudioRef} autoPlay playsInline className="conversation-audio" />

      {typeof document !== 'undefined' && isEmojiPickerOpen && thread && isMobileLayout
        ? createPortal(
            <AnimatePresence>
              <div
                className="emoji-picker-overlay"
                onClick={closeEmojiPicker}
              >
                {emojiPicker}
              </div>
            </AnimatePresence>,
            document.body,
          )
        : null}
    </motion.section>
  )
}
