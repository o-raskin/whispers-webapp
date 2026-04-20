import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatSidebar } from './ChatSidebar'

describe('ChatSidebar', () => {
  test('shows the waiting empty state when disconnected', () => {
    render(
      <ChatSidebar
        currentUser={null}
        currentUserId=""
        chats={[]}
        isPrivateChatAvailable={true}
        selectedChatId={null}
        users={{}}
        status="disconnected"
        newChatUserId=""
        onNewChatUserIdChange={vi.fn()}
        onCreateDirectChat={vi.fn()}
        onCreatePrivateChat={vi.fn()}
        onSelectChat={vi.fn()}
        onDisconnect={vi.fn()}
      />,
    )

    expect(screen.getByText('Waiting for connection')).toBeInTheDocument()
    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(document.querySelector('.sidebar-user-divider')).toBeInTheDocument()
    expect(document.querySelector('.sidebar-user-action')).toBeInTheDocument()
    expect(screen.queryByText('Menu')).not.toBeInTheDocument()
  })

  test('shows chat list edge fades only when the list can scroll', async () => {
    render(
      <ChatSidebar
        currentUser={null}
        currentUserId="alice"
        chats={[
          {
            chatId: 'chat-1',
            username: 'bob',
            type: 'DIRECT',
            firstName: 'Bob',
            lastName: 'Example',
            preview: 'Latest note',
            lastMessageTimestamp: '2026-04-12T10:00:00',
          },
        ]}
        isPrivateChatAvailable={true}
        selectedChatId={null}
        users={{}}
        status="connected"
        newChatUserId=""
        onNewChatUserIdChange={vi.fn()}
        onCreateDirectChat={vi.fn()}
        onCreatePrivateChat={vi.fn()}
        onSelectChat={vi.fn()}
        onDisconnect={vi.fn()}
      />,
    )

    const sidebarScroll = document.querySelector('.sidebar-scroll') as HTMLDivElement
    const [topFade, bottomFade] = Array.from(
      document.querySelectorAll('.sidebar-edge-fade'),
    ) as HTMLDivElement[]

    Object.defineProperty(sidebarScroll, 'clientHeight', {
      configurable: true,
      value: 200,
    })
    Object.defineProperty(sidebarScroll, 'scrollHeight', {
      configurable: true,
      value: 480,
    })
    Object.defineProperty(sidebarScroll, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 0,
    })

    fireEvent(window, new Event('resize'))

    await screen.findByText('Latest note')
    expect(screen.getByText('Bob Example')).toBeInTheDocument()
    expect(topFade).not.toHaveClass('visible')
    expect(bottomFade).toHaveClass('visible')

    sidebarScroll.scrollTop = 140
    fireEvent.scroll(sidebarScroll)

    expect(topFade).toHaveClass('visible')
    expect(bottomFade).toHaveClass('visible')

    sidebarScroll.scrollTop = 280
    fireEvent.scroll(sidebarScroll)

    expect(topFade).toHaveClass('visible')
    expect(bottomFade).not.toHaveClass('visible')
  })

  test('toggles info, updates search, starts chats, and selects a conversation', async () => {
    const user = userEvent.setup()
    const onNewChatUserIdChange = vi.fn()
    const onCreateDirectChat = vi.fn()
    const onCreatePrivateChat = vi.fn()
    const onSelectChat = vi.fn()
    const onDisconnect = vi.fn()

    render(
      <ChatSidebar
        currentUser={{
          userId: 'user-1',
          username: 'alice',
          email: 'alice@example.com',
          firstName: 'Alice',
          lastName: 'Johnson',
          pictureUrl: 'https://example.com/alice.png',
        }}
        currentUserId="alice"
        chats={[
          {
            chatId: 'chat-1',
            username: 'bob',
            type: 'DIRECT',
            firstName: 'Bob',
            lastName: 'Example',
            profileUrl: 'https://example.com/bob.png',
            preview: 'Latest note',
            lastMessageTimestamp: '2026-04-10T10:00:00',
            unreadCount: 2,
          },
        ]}
        isPrivateChatAvailable={true}
        selectedChatId="chat-1"
        users={{
          bob: {
            username: 'bob',
            lastPingTime: '2026-04-12T09:59:50',
            lastPingReceivedAt: Date.now(),
          },
        }}
        status="connected"
        newChatUserId=""
        onNewChatUserIdChange={onNewChatUserIdChange}
        onCreateDirectChat={onCreateDirectChat}
        onCreatePrivateChat={onCreatePrivateChat}
        onSelectChat={onSelectChat}
        onDisconnect={onDisconnect}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'About conversations' }))
    await user.click(screen.getByRole('button', { name: 'Open account menu' }))
    expect(screen.getByRole('menu', { name: 'Account menu' })).toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Disconnect' }))
    fireEvent.change(screen.getByLabelText('Search user to start a new chat'), {
      target: { value: 'carol' },
    })
    await user.click(screen.getByRole('button', { name: 'Start direct chat' }))
    await user.click(screen.getByRole('button', { name: 'Start private chat' }))
    await user.click(screen.getByRole('button', { name: /bob/i }))

    expect(
      screen.getByText(/private channels, presence signals, and the latest activity/i),
    ).toBeInTheDocument()
    expect(onNewChatUserIdChange).toHaveBeenLastCalledWith('carol')
    expect(onCreateDirectChat).toHaveBeenCalledTimes(1)
    expect(onCreatePrivateChat).toHaveBeenCalledTimes(1)
    expect(onDisconnect).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu', { name: 'Account menu' })).not.toBeInTheDocument()
    expect(onSelectChat).toHaveBeenCalledWith('chat-1')
    expect(screen.getByText('Bob Example')).toBeInTheDocument()
    expect(screen.getByAltText('Bob Example')).toHaveAttribute(
      'src',
      'https://example.com/bob.png',
    )
    expect(screen.getByText('Latest note')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Fri')).toBeInTheDocument()
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByAltText('Alice Johnson')).toHaveAttribute(
      'src',
      'https://example.com/alice.png',
    )
  })
})
