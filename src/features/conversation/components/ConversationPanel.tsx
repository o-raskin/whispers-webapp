import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { ConnectionStatus } from '../../../shared/types/chat'
import type {
  CallPhase,
  ChatSummary,
  ChatThread,
  ChatType,
  UserPresence,
} from '../../../shared/types/chat'
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
import { ConversationPrivateBanner } from './ConversationPrivateBanner'
import { useConversationComposer } from '../hooks/useConversationComposer'
import { useConversationHistoryViewport } from '../hooks/useConversationHistoryViewport'
import './conversation-shell.css'

interface PrivateConversationState {
  accessState: 'idle' | 'loading' | 'ready' | 'missing-key' | 'setting-up' | 'error'
  notice: string | null
}

interface EditingMessageState {
  messageId: string
  text: string
}

export interface ConversationPanelProps {
  chatType: ChatType | null
  participantProfile?: Pick<
    ChatSummary,
    'firstName' | 'lastName' | 'profileUrl' | 'username'
  > | null
  privateChatState: PrivateConversationState | null
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
  editingMessage: EditingMessageState | null
  messageDraft: string
  onMessageDraftChange: (value: string) => void
  onBackToInbox: () => void
  onAcceptCall: () => void
  onDeclineCall: () => void
  onEndCall: () => void
  onDeleteMessage: (messageId: string) => void
  onEditMessage: (message: { chatId: string; messageId: string; text: string }) => void
  onCancelMessageEdit: () => void
  onSendMessage: () => void
  onSetUpPrivateChatBrowser: () => void
  onStartCall: () => void
}

export function ConversationPanel({
  chatType,
  participantProfile = null,
  privateChatState,
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
  editingMessage,
  messageDraft,
  onMessageDraftChange,
  onBackToInbox,
  onAcceptCall,
  onDeclineCall,
  onEndCall,
  onDeleteMessage,
  onEditMessage,
  onCancelMessageEdit,
  onSendMessage,
  onSetUpPrivateChatBrowser,
  onStartCall,
}: ConversationPanelProps) {
  const localAudioRef = useRef<HTMLAudioElement | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const isPrivateChat = chatType === 'PRIVATE'
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
    ? [participantProfile?.firstName?.trim(), participantProfile?.lastName?.trim()]
        .filter(Boolean)
        .join(' ') || participantProfile?.username || thread.participant
    : isMobilePendingThread
      ? pendingParticipant ?? 'Loading conversation'
      : 'Welcome to Whispers'

  const subtitle = thread
    ? isPrivateChat
      ? isRecipientOnline
        ? 'Online in this private chat'
        : `Private chat • Last seen: ${formatPresenceLabel(user?.lastPingTime ?? null)}`
      : isRecipientOnline
        ? 'Online'
        : `Last seen: ${formatPresenceLabel(user?.lastPingTime ?? null)}`
    : isMobilePendingThread
      ? 'Loading messages...'
    : 'No chat selected'
  const callButtonLabel = isPrivateChat
    ? 'Audio calls are unavailable in private chats'
    : isActiveCallPhase
      ? 'End audio call'
      : 'Start audio call'
  const isCallButtonDisabled =
    !thread ||
    connectionStatus !== 'connected' ||
    showHistoryLoadingState ||
    isIncomingCall ||
    isPrivateChat
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
    isHistoryAtBottom,
    historyRef,
    isHistoryAnchored,
    scrollHistoryToLatest,
    updateHistoryViewportState,
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

  useEffect(() => {
    if (!editingMessage) {
      return
    }

    window.requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(messageDraft.length, messageDraft.length)
    })
  }, [editingMessage, messageDraft.length, textareaRef])

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
        chatType={chatType}
        callButtonLabel={callButtonLabel}
        conversationTitle={conversationTitle}
        isActiveCallPhase={isActiveCallPhase}
        isCallButtonDisabled={isCallButtonDisabled}
        isMobileLayout={isMobileLayout}
        isRecipientOnline={isRecipientOnline}
        isRemoteTyping={isRemoteTyping}
        pendingParticipant={pendingParticipant}
        participantProfile={participantProfile}
        subtitle={subtitle}
        thread={thread}
        onBackToInbox={onBackToInbox}
        onCallButtonClick={isActiveCallPhase ? onEndCall : onStartCall}
      />

      <ConversationPrivateBanner
        isPrivateChat={isPrivateChat}
        privateChatState={privateChatState}
        onSetUpPrivateChatBrowser={onSetUpPrivateChatBrowser}
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
        isHistoryAtBottom={isHistoryAtBottom}
        isMobileLayout={isMobileLayout}
        onHistoryAnimationComplete={() => {
          updateHistoryViewportState()
        }}
        onScrollToLatest={scrollHistoryToLatest}
        onDeleteMessage={chatType === 'PRIVATE' ? undefined : onDeleteMessage}
        onEditMessage={chatType === 'PRIVATE' ? undefined : onEditMessage}
        participantProfile={participantProfile}
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
        isPrivateChat={isPrivateChat}
        messageDraft={messageDraft}
        editingMessage={editingMessage}
        privateChatState={privateChatState}
        textareaRef={textareaRef}
        thread={thread}
        onBlur={() => setIsComposerFocused(false)}
        onChange={handleChange}
        onFocus={() => setIsComposerFocused(true)}
        onKeyDown={handleKeyDown}
        onCancelMessageEdit={onCancelMessageEdit}
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
