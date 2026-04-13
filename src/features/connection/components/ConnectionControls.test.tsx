import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectionControls } from './ConnectionControls'

describe('ConnectionControls', () => {
  test('updates fields and triggers connect and disconnect handlers', async () => {
    const user = userEvent.setup()
    const onServerUrlChange = vi.fn()
    const onUserIdChange = vi.fn()
    const onConnect = vi.fn()
    const onDisconnect = vi.fn()

    render(
      <ConnectionControls
        serverUrl="ws://192.168.0.10:8080/ws/user"
        userId="alice"
        status="connecting"
        onServerUrlChange={onServerUrlChange}
        onUserIdChange={onUserIdChange}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
      />,
    )

    fireEvent.change(screen.getByLabelText('Server URL'), {
      target: { value: 'ws://example.test/ws/user' },
    })
    fireEvent.change(screen.getByLabelText('Your user ID'), {
      target: { value: 'bob' },
    })
    await user.click(screen.getByRole('button', { name: 'Connect' }))
    await user.click(screen.getByRole('button', { name: 'Disconnect' }))

    expect(onServerUrlChange).toHaveBeenLastCalledWith('ws://example.test/ws/user')
    expect(onUserIdChange).toHaveBeenLastCalledWith('bob')
    expect(onConnect).toHaveBeenCalledTimes(1)
    expect(onDisconnect).toHaveBeenCalledTimes(1)
    expect(
      screen.getByText('Establishing a secure realtime tunnel to your backend.'),
    ).toBeInTheDocument()
  })

  test('can hide the status row and disconnect button', () => {
    render(
      <ConnectionControls
        serverUrl="ws://192.168.0.10:8080/ws/user"
        userId=""
        status="disconnected"
        onServerUrlChange={vi.fn()}
        onUserIdChange={vi.fn()}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        showStatusRow={false}
        showDisconnect={false}
        idPrefix="welcome"
        layout="stacked"
      />,
    )

    expect(screen.queryByText('Disconnect')).not.toBeInTheDocument()
    expect(screen.queryByText(/unlock chats and live presence/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Server URL')).toHaveAttribute('id', 'welcome-server-url')
  })
})
