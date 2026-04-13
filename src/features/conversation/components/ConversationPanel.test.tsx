import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationPanel } from './ConversationPanel'
import type { ChatThread, UserPresence } from '../../../shared/types/chat'

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

  test('renders the welcome state when no thread is selected', () => {
    render(
      <ConversationPanel
        thread={null}
        user={null}
        currentUserId="alice"
        isMobileLayout={false}
        connectionStatus="disconnected"
        isHistoryLoading={false}
        isDrafting={false}
        remoteTypingLabel={null}
        messageDraft=""
        onMessageDraftChange={vi.fn()}
        onBackToInbox={vi.fn()}
        onSendMessage={vi.fn()}
      />,
    )

    expect(screen.getByText('Welcome to Whispers')).toBeInTheDocument()
    expect(screen.getByText('Your conversation space is ready.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
  })

  test('renders thread details, typing state, and message meta', async () => {
    const userEventApi = userEvent.setup()
    const onBackToInbox = vi.fn()
    const onSendMessage = vi.fn()
    const onMessageDraftChange = vi.fn()

    render(
      <ConversationPanel
        thread={thread}
        user={user}
        currentUserId="alice"
        isMobileLayout={true}
        connectionStatus="connected"
        isHistoryLoading={false}
        isDrafting={true}
        remoteTypingLabel="bob"
        messageDraft="Draft copy"
        onMessageDraftChange={onMessageDraftChange}
        onBackToInbox={onBackToInbox}
        onSendMessage={onSendMessage}
      />,
    )

    expect(screen.getByRole('heading', { name: 'bob' })).toBeInTheDocument()
    expect(screen.getByText('typing')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Hello Alice')).toBeInTheDocument()
    expect(screen.getByText('Hi Bob')).toBeInTheDocument()

    await userEventApi.click(screen.getByRole('button', { name: 'Back to inbox' }))
    await userEventApi.click(screen.getByRole('button', { name: 'Send message' }))

    expect(onBackToInbox).toHaveBeenCalledTimes(1)
    expect(onSendMessage).toHaveBeenCalledTimes(1)
  })

  test('sends on enter and inserts emoji into the draft at the cursor position', async () => {
    const userEventApi = userEvent.setup()
    const onSendMessage = vi.fn()
    const onMessageDraftChange = vi.fn()

    render(
      <ConversationPanel
        thread={thread}
        user={user}
        currentUserId="alice"
        isMobileLayout={false}
        connectionStatus="connected"
        isHistoryLoading={false}
        isDrafting={false}
        remoteTypingLabel={null}
        messageDraft="Hi there"
        onMessageDraftChange={onMessageDraftChange}
        onBackToInbox={vi.fn()}
        onSendMessage={onSendMessage}
      />,
    )

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

    render(
      <ConversationPanel
        thread={thread}
        user={user}
        currentUserId="alice"
        isMobileLayout={true}
        connectionStatus="connected"
        isHistoryLoading={false}
        isDrafting={false}
        remoteTypingLabel={null}
        messageDraft="Hi there"
        onMessageDraftChange={vi.fn()}
        onBackToInbox={vi.fn()}
        onSendMessage={vi.fn()}
      />,
    )

    await userEventApi.click(screen.getByRole('button', { name: 'Choose emoji' }))

    expect(screen.getByRole('dialog', { name: 'Emoji picker' })).toBeInTheDocument()
    expect(screen.getByRole('listbox', { name: 'Emoji choices' })).toBeInTheDocument()
  })
})
