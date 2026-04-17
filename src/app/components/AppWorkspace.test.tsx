import { render, screen } from '@testing-library/react'
import type { ChatSidebarProps } from '../../features/chat-list/components/ChatSidebar'
import type { ConversationPanelProps } from '../../features/conversation/components/ConversationPanel'
import { AppWorkspace } from './AppWorkspace'

vi.mock('../../features/connection/components/ConnectionPanel', () => ({
  ConnectionPanel: ({ isCompactMobile }: { isCompactMobile: boolean }) => (
    <div data-testid="connection-panel">{isCompactMobile ? 'compact' : 'default'}</div>
  ),
}))

vi.mock('../../features/chat-list/components/ChatSidebar', () => ({
  ChatSidebar: ({ selectedChatId }: { selectedChatId: string | null }) => (
    <div data-testid="sidebar">{selectedChatId ?? 'none'}</div>
  ),
}))

vi.mock('../../features/conversation/components/ConversationPanel', () => ({
  ConversationPanel: ({ isMobileLayout }: { isMobileLayout: boolean }) => (
    <div data-testid="conversation">{isMobileLayout ? 'mobile' : 'desktop'}</div>
  ),
}))

vi.mock('../../features/event-log/components/EventLogPanel', () => ({
  EventLogPanel: ({ lines }: { lines: string[] }) => (
    <div data-testid="event-log">{lines.join('|')}</div>
  ),
}))

const baseSidebarProps: ChatSidebarProps = {
  chats: [],
  currentUserId: 'alice',
  newChatUserId: '',
  onCreateChat: vi.fn(),
  onDisconnect: vi.fn(),
  onNewChatUserIdChange: vi.fn(),
  onSelectChat: vi.fn(),
  selectedChatId: null,
  status: 'connected',
  users: {},
}

const baseConversationProps: ConversationPanelProps = {
  callPhase: 'idle',
  connectionStatus: 'connected',
  currentUserId: 'alice',
  isDrafting: false,
  isHistoryLoading: false,
  isMobileLayout: false,
  localCallStream: null,
  messageDraft: '',
  onAcceptCall: vi.fn(),
  onBackToInbox: vi.fn(),
  onDeclineCall: vi.fn(),
  onEndCall: vi.fn(),
  onMessageDraftChange: vi.fn(),
  onSendMessage: vi.fn(),
  onStartCall: vi.fn(),
  pendingParticipantName: null,
  remoteCallStream: null,
  remoteTypingLabel: null,
  thread: null,
  user: null,
}

describe('AppWorkspace', () => {
  test('renders the desktop workspace contract', () => {
    render(
      <AppWorkspace
        conversationProps={baseConversationProps}
        eventLogLines={['one', 'two']}
        isMobileChatOpen={false}
        isMobileLayout={false}
        selectedChatId={null}
        sidebarProps={baseSidebarProps}
      />,
    )

    expect(screen.getByTestId('connection-panel')).toHaveTextContent('default')
    expect(screen.getByTestId('sidebar')).toHaveTextContent('none')
    expect(screen.getByTestId('conversation')).toHaveTextContent('desktop')
    expect(screen.getByTestId('event-log')).toHaveTextContent('one|two')
    expect(document.querySelector('.mobile-workspace')).not.toBeInTheDocument()
    expect(document.querySelector('.workspace-main')).toBeInTheDocument()
  })

  test('renders the mobile workspace contract with the chat pane open', () => {
    render(
      <AppWorkspace
        conversationProps={{ ...baseConversationProps, isMobileLayout: true }}
        eventLogLines={['mobile']}
        isMobileChatOpen={true}
        isMobileLayout={true}
        selectedChatId="chat-1"
        sidebarProps={{ ...baseSidebarProps, selectedChatId: 'chat-1' }}
      />,
    )

    expect(screen.getByTestId('connection-panel')).toHaveTextContent('compact')
    expect(screen.getByTestId('sidebar')).toHaveTextContent('chat-1')
    expect(screen.getByTestId('conversation')).toHaveTextContent('mobile')
    expect(document.querySelector('.mobile-workspace')).toBeInTheDocument()
    expect(document.querySelector('.mobile-screen-inbox')).toHaveStyle({
      pointerEvents: 'none',
    })
    expect(document.querySelector('.mobile-screen-chat')).toHaveStyle({
      pointerEvents: 'auto',
    })
  })
})
