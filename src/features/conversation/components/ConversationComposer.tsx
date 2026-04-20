import { AnimatePresence, motion } from 'framer-motion'
import type { ChangeEvent, KeyboardEvent, ReactNode, RefObject } from 'react'
import type { ConnectionStatus, ChatThread } from '../../../shared/types/chat'
import { itemReveal, panelTransition, springTransition } from '../../../shared/motion/presets'
import './conversation-composer.css'

interface ConversationComposerProps {
  connectionStatus: ConnectionStatus
  desktopEmojiPicker: ReactNode
  isComposerFocused: boolean
  isDrafting: boolean
  isEmojiPickerOpen: boolean
  isPrivateChat: boolean
  messageDraft: string
  privateChatState: {
    accessState: 'idle' | 'loading' | 'ready' | 'missing-key' | 'setting-up' | 'error'
    notice: string | null
  } | null
  textareaRef: RefObject<HTMLTextAreaElement | null>
  thread: ChatThread | null
  onBlur: () => void
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
  onFocus: () => void
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  onSubmit: () => void
  onToggleEmojiPicker: () => void
}

export function ConversationComposer({
  connectionStatus,
  desktopEmojiPicker,
  isComposerFocused,
  isDrafting,
  isEmojiPickerOpen,
  isPrivateChat,
  messageDraft,
  privateChatState,
  textareaRef,
  thread,
  onBlur,
  onChange,
  onFocus,
  onKeyDown,
  onSubmit,
  onToggleEmojiPicker,
}: ConversationComposerProps) {
  const privateChatAccessState = privateChatState?.accessState ?? 'idle'
  const isPrivateComposerLocked =
    isPrivateChat &&
    (
      privateChatAccessState === 'missing-key' ||
      privateChatAccessState === 'setting-up' ||
      privateChatAccessState === 'error'
    )
  const isComposerDisabled = !thread || connectionStatus !== 'connected' || isPrivateComposerLocked
  const composerPlaceholder = !thread
    ? 'Choose a conversation to start typing'
    : isPrivateChat
      ? privateChatAccessState === 'ready'
        ? `Send a private message to ${thread.participant}`
        : privateChatAccessState === 'setting-up'
          ? 'Preparing private access for this browser'
          : 'Set up this browser to send private messages'
      : `Send a message to ${thread.participant}`
  const composerMeta = !thread
    ? 'Channel idle'
    : isPrivateChat
      ? privateChatAccessState === 'ready'
        ? 'End-to-end encrypted in this browser'
        : privateChatAccessState === 'setting-up'
          ? 'Preparing secure browser key...'
          : 'Set up this browser to send new private messages'
      : 'Shift+Enter for newline'

  return (
    <motion.form
      className={`composer-panel ${isComposerFocused ? 'is-focused' : ''} ${isDrafting ? 'is-drafting' : ''}`}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
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
              placeholder={composerPlaceholder}
              value={messageDraft}
              onChange={onChange}
              onKeyDown={onKeyDown}
              onFocus={onFocus}
              onBlur={onBlur}
              enterKeyHint="send"
              rows={3}
              disabled={isComposerDisabled}
            />
            <motion.button
              className={`composer-emoji-button ${isEmojiPickerOpen ? 'is-open' : ''}`}
              type="button"
              aria-label="Choose emoji"
              disabled={isComposerDisabled}
              whileHover={isComposerDisabled ? undefined : { y: -1, scale: 1.01 }}
              whileTap={isComposerDisabled ? undefined : { scale: 0.97 }}
              transition={springTransition}
              onClick={() => {
                if (isComposerDisabled) {
                  return
                }

                onToggleEmojiPicker()
              }}
            >
              <span className="composer-emoji-icon" aria-hidden="true">
                ☺
              </span>
            </motion.button>
            <AnimatePresence>
              {isEmojiPickerOpen && thread && !isComposerDisabled ? desktopEmojiPicker : null}
            </AnimatePresence>
          </div>
          <motion.button
            className="send-button"
            type="submit"
            aria-label="Send message"
            disabled={isComposerDisabled}
            whileHover={
              isComposerDisabled ? undefined : { y: -2, scale: 1.01 }
            }
            whileTap={isComposerDisabled ? undefined : { scale: 0.985 }}
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
          <span>{composerMeta}</span>
        </div>
      </div>
    </motion.form>
  )
}
