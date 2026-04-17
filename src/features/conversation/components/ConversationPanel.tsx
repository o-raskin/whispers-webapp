import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { ConnectionStatus } from '../../../shared/types/chat'
import type { CallPhase, ChatThread, UserPresence } from '../../../shared/types/chat'
import {
  sectionReveal,
} from '../../../shared/motion/presets'
import {
  formatPresenceLabel,
  isUserOnline,
} from '../../../shared/utils/presence'
import { ConversationCallBanner } from './ConversationCallBanner'
import { ConversationComposer } from './ConversationComposer'
import { ConversationEmojiPicker } from './ConversationEmojiPicker'
import { ConversationHeader } from './ConversationHeader'
import { ConversationHistory } from './ConversationHistory'
import { useConversationComposer } from '../hooks/useConversationComposer'
import { useConversationHistoryViewport } from '../hooks/useConversationHistoryViewport'
import './conversation-shell.css'

export interface ConversationPanelProps {
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
  const localAudioRef = useRef<HTMLAudioElement | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const isRecipientOnline = isUserOnline(user)
  const isRemoteTyping = Boolean(remoteTypingLabel)
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
  const callButtonLabel = isActiveCallPhase ? 'End audio call' : 'Start audio call'
  const isCallButtonDisabled =
    !thread ||
    connectionStatus !== 'connected' ||
    showHistoryLoadingState ||
    isIncomingCall
  const {
    closeEmojiPicker,
    handleChange,
    handleEmojiSelect,
    handleKeyDown,
    isComposerFocused,
    isEmojiPickerOpen,
    setIsComposerFocused,
    textareaRef,
    toggleEmojiPicker,
  } = useConversationComposer({
    messageDraft,
    onMessageDraftChange,
    onSendMessage,
    threadChatId: thread?.chatId ?? null,
  })
  const {
    handleHistoryBottomAnchorRef,
    historyFadeState,
    historyRef,
    isHistoryAnchored,
    scrollHistoryToLatest,
    setIsHistoryAnchored,
  } = useConversationHistoryViewport({
    messageCount: thread?.messages.length ?? 0,
    showHistoryLoadingState,
    threadChatId: thread?.chatId ?? null,
  })
  const visibleHistoryFadeState =
    thread && !showHistoryLoadingState
      ? historyFadeState
      : {
          showTopFade: false,
          showBottomFade: false,
        }

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

  const emojiPicker = (
    <ConversationEmojiPicker
      isMobileLayout={isMobileLayout}
      onClose={closeEmojiPicker}
      onSelectEmoji={handleEmojiSelect}
    />
  )

  return (
    <motion.section className="conversation" variants={sectionReveal}>
      <ConversationHeader
        callButtonLabel={callButtonLabel}
        conversationTitle={conversationTitle}
        isActiveCallPhase={isActiveCallPhase}
        isCallButtonDisabled={isCallButtonDisabled}
        isMobileLayout={isMobileLayout}
        isRecipientOnline={isRecipientOnline}
        isRemoteTyping={isRemoteTyping}
        pendingParticipant={pendingParticipant}
        subtitle={subtitle}
        thread={thread}
        onBackToInbox={onBackToInbox}
        onCallButtonClick={isActiveCallPhase ? onEndCall : onStartCall}
      />

      <ConversationCallBanner
        callParticipantLabel={callParticipantLabel}
        callPhase={callPhase}
        onAcceptCall={onAcceptCall}
        onDeclineCall={onDeclineCall}
        onEndCall={onEndCall}
      />

      <ConversationHistory
        currentUserId={currentUserId}
        handleHistoryBottomAnchorRef={handleHistoryBottomAnchorRef}
        historyRef={historyRef}
        isHistoryAnchored={isHistoryAnchored}
        isMobileLayout={isMobileLayout}
        onHistoryAnimationComplete={() => {
          scrollHistoryToLatest()
          setIsHistoryAnchored(true)
        }}
        onScrollToLatest={scrollHistoryToLatest}
        showHistoryLoadingState={showHistoryLoadingState}
        thread={thread}
        visibleHistoryFadeState={visibleHistoryFadeState}
      />

      <ConversationComposer
        connectionStatus={connectionStatus}
        desktopEmojiPicker={!isMobileLayout ? emojiPicker : null}
        isComposerFocused={isComposerFocused}
        isDrafting={isDrafting}
        isEmojiPickerOpen={isEmojiPickerOpen}
        messageDraft={messageDraft}
        textareaRef={textareaRef}
        thread={thread}
        onBlur={() => setIsComposerFocused(false)}
        onChange={handleChange}
        onFocus={() => setIsComposerFocused(true)}
        onKeyDown={handleKeyDown}
        onSubmit={onSendMessage}
        onToggleEmojiPicker={toggleEmojiPicker}
      />

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
