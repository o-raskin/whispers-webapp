import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationPanel } from './ConversationPanel'
import type { CallPhase, ChatThread, UserPresence } from '../../../shared/types/chat'

describe('ConversationPanel', () => {
  const thread: ChatThread = {
    chatId: 'chat-1',
    participant: 'bob',
    messages: [
      {
        id: 'one',
        chatId: 'chat-1',
        senderUserId: 'bob',
        direction: 'received',
        text: 'Hello Alice',
        timestamp: '2026-04-12T10:00:00',
      },
      {
        id: 'two',
        chatId: 'chat-1',
        senderUserId: 'alice',
        direction: 'sent',
        text: 'Hi Bob',
        timestamp: '2026-04-12T10:01:00',
      },
    ],
  }

  const user: UserPresence = {
    username: 'bob',
    lastPingTime: '2026-04-12T09:59:50',
    lastPingReceivedAt: Date.now(),
  }

  function renderConversationPanel({
    callPhase = 'idle',
    isHistoryLoading = false,
    isMobileLayout = false,
    messageDraft = '',
    onAcceptCall = vi.fn(),
    onBackToInbox = vi.fn(),
    onDeclineCall = vi.fn(),
    onEndCall = vi.fn(),
    onMessageDraftChange = vi.fn(),
    onSendMessage = vi.fn(),
    onStartCall = vi.fn(),
    pendingParticipantName = null,
    remoteTypingLabel = null,
    selectedThread = thread,
  }: {
    callPhase?: CallPhase
    isHistoryLoading?: boolean
    isMobileLayout?: boolean
    messageDraft?: string
    onAcceptCall?: () => void
    onBackToInbox?: () => void
    onDeclineCall?: () => void
    onEndCall?: () => void
    onMessageDraftChange?: (value: string) => void
    onSendMessage?: () => void
    onStartCall?: () => void
    pendingParticipantName?: string | null
    remoteTypingLabel?: string | null
    selectedThread?: ChatThread | null
  }) {
    return render(
      <ConversationPanel
        participantProfile={
          selectedThread
            ? {
                username: 'bob',
                firstName: 'Bob',
                lastName: 'Example',
                profileUrl: 'https://example.com/bob.png',
              }
            : null
        }
        thread={selectedThread}
        pendingParticipantName={pendingParticipantName}
        user={selectedThread ? user : null}
        currentUserId="alice"
        isMobileLayout={isMobileLayout}
        connectionStatus={selectedThread ? 'connected' : 'disconnected'}
        isHistoryLoading={isHistoryLoading}
        isDrafting={Boolean(messageDraft.trim())}
        remoteTypingLabel={remoteTypingLabel}
        callPhase={callPhase}
        localCallStream={null}
        remoteCallStream={null}
        messageDraft={messageDraft}
        onMessageDraftChange={onMessageDraftChange}
        onBackToInbox={onBackToInbox}
        onAcceptCall={onAcceptCall}
        onDeclineCall={onDeclineCall}
        onEndCall={onEndCall}
        onSendMessage={onSendMessage}
        onStartCall={onStartCall}
      />,
    )
  }

  test('renders the welcome state when no thread is selected', () => {
    renderConversationPanel({
      selectedThread: null,
    })

    expect(screen.getByText('Welcome to Whispers')).toBeInTheDocument()
    expect(screen.getByText('Your conversation space is ready.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Start audio call' })).toBeDisabled()
  })

  test('does not render the desktop welcome copy during mobile loading', () => {
    renderConversationPanel({
      selectedThread: null,
      pendingParticipantName: 'bob',
      isMobileLayout: true,
      isHistoryLoading: true,
    })

    expect(screen.getByRole('heading', { name: 'bob' })).toBeInTheDocument()
    expect(screen.getByText('Loading messages...')).toBeInTheDocument()
    expect(screen.getByLabelText('Loading conversation')).toBeInTheDocument()
    expect(screen.queryByText('Your conversation space is ready.')).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Connect to the backend, pick a conversation/i),
    ).not.toBeInTheDocument()
  })

  test('renders thread details, typing state, and message meta', async () => {
    const userEventApi = userEvent.setup()
    const onBackToInbox = vi.fn()
    const onSendMessage = vi.fn()
    const onMessageDraftChange = vi.fn()
    const onStartCall = vi.fn()

    renderConversationPanel({
      isMobileLayout: true,
      messageDraft: 'Draft copy',
      onBackToInbox,
      onMessageDraftChange,
      onSendMessage,
      onStartCall,
      remoteTypingLabel: 'bob',
    })

    expect(screen.getByRole('heading', { name: 'Bob Example' })).toBeInTheDocument()
    expect(screen.getByAltText('Bob Example')).toHaveAttribute(
      'src',
      'https://example.com/bob.png',
    )
    expect(screen.getByRole('button', { name: 'Start audio call' })).toBeInTheDocument()
    expect(screen.getByText('typing')).toBeInTheDocument()
    expect(screen.getAllByText('Bob Example')).toHaveLength(2)
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Hello Alice')).toBeInTheDocument()
    expect(screen.getByText('Hi Bob')).toBeInTheDocument()

    await userEventApi.click(screen.getByRole('button', { name: 'Back to inbox' }))
    await userEventApi.click(screen.getByRole('button', { name: 'Start audio call' }))
    await userEventApi.click(screen.getByRole('button', { name: 'Send message' }))

    expect(onBackToInbox).toHaveBeenCalledTimes(1)
    expect(onStartCall).toHaveBeenCalledTimes(1)
    expect(onSendMessage).toHaveBeenCalledTimes(1)
  })

  test('shows incoming and active call controls', async () => {
    const userEventApi = userEvent.setup()
    const onAcceptCall = vi.fn()
    const onDeclineCall = vi.fn()
    const onEndCall = vi.fn()

    const { rerender } = renderConversationPanel({
      callPhase: 'incoming',
      onAcceptCall,
      onDeclineCall,
      onEndCall,
    })

    expect(screen.getByText('bob is calling')).toBeInTheDocument()

    await userEventApi.click(screen.getByRole('button', { name: 'Accept' }))
    await userEventApi.click(screen.getByRole('button', { name: 'Decline' }))

    expect(onAcceptCall).toHaveBeenCalledTimes(1)
    expect(onDeclineCall).toHaveBeenCalledTimes(1)

    rerender(
      <ConversationPanel
        participantProfile={{
          username: 'bob',
          firstName: 'Bob',
          lastName: 'Example',
          profileUrl: 'https://example.com/bob.png',
        }}
        thread={thread}
        user={user}
        currentUserId="alice"
        isMobileLayout={true}
        connectionStatus="connected"
        isHistoryLoading={false}
        isDrafting={false}
        remoteTypingLabel={null}
        callPhase="active"
        localCallStream={null}
        remoteCallStream={null}
        messageDraft=""
        onMessageDraftChange={vi.fn()}
        onBackToInbox={vi.fn()}
        onAcceptCall={vi.fn()}
        onDeclineCall={vi.fn()}
        onEndCall={onEndCall}
        onSendMessage={vi.fn()}
        onStartCall={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'End audio call' })).toBeInTheDocument()

    await userEventApi.click(screen.getByRole('button', { name: 'Hang up' }))

    expect(onEndCall).toHaveBeenCalledTimes(1)
  })

  test('shows the compact call banner without changing thread visibility', () => {
    renderConversationPanel({
      callPhase: 'incoming',
    })

    expect(screen.getByText('bob is calling')).toBeInTheDocument()
    expect(screen.getByText('Hello Alice')).toBeInTheDocument()
    expect(screen.getByText('Hi Bob')).toBeInTheDocument()
  })

  test('keeps visible messages and enabled call control during background history refresh', () => {
    renderConversationPanel({
      isHistoryLoading: true,
      callPhase: 'idle',
    })

    expect(screen.getByText('Hello Alice')).toBeInTheDocument()
    expect(screen.getByText('Hi Bob')).toBeInTheDocument()
    expect(screen.queryByLabelText('Loading conversation')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start audio call' })).toBeEnabled()
  })

  test('sends on enter and inserts emoji into the draft at the cursor position', async () => {
    const userEventApi = userEvent.setup()
    const onSendMessage = vi.fn()
    const onMessageDraftChange = vi.fn()

    renderConversationPanel({
      isMobileLayout: false,
      messageDraft: 'Hi there',
      onMessageDraftChange,
      onSendMessage,
    })

    const textarea = screen.getByPlaceholderText('Send a message to bob') as HTMLTextAreaElement
    textarea.setSelectionRange(2, 2)

    await userEventApi.click(screen.getByRole('button', { name: 'Choose emoji' }))
    await userEventApi.click(screen.getByRole('button', { name: 'Insert 😀' }))
    await userEventApi.type(textarea, '{enter}')

    expect(onMessageDraftChange).toHaveBeenCalledWith('Hi😀 there')
    expect(onSendMessage).toHaveBeenCalledTimes(1)
  })

  test('opens the emoji picker as a centered mobile dialog', async () => {
    const userEventApi = userEvent.setup()

    renderConversationPanel({
      isMobileLayout: true,
      messageDraft: 'Hi there',
    })

    await userEventApi.click(screen.getByRole('button', { name: 'Choose emoji' }))

    expect(screen.getByRole('dialog', { name: 'Emoji picker' })).toBeInTheDocument()
    expect(screen.getByRole('listbox', { name: 'Emoji choices' })).toBeInTheDocument()
  })
})
