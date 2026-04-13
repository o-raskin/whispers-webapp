import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WelcomeExperience } from './WelcomeExperience'

describe('WelcomeExperience', () => {
  test('renders connection status copy and delegates control handlers', async () => {
    const user = userEvent.setup()
    const onServerUrlChange = vi.fn()
    const onUserIdChange = vi.fn()
    const onConnect = vi.fn()
    const onDisconnect = vi.fn()

    render(
      <WelcomeExperience
        serverUrl="ws://192.168.0.10:8080/ws/user"
        userId="alice"
        status="connected"
        onServerUrlChange={onServerUrlChange}
        onUserIdChange={onUserIdChange}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
      />,
    )

    expect(screen.getByText('Identity: alice')).toBeInTheDocument()
    expect(
      screen.getByText(
        /Realtime channel is live. Step into the workspace and continue the conversation./,
      ),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Server URL'), {
      target: { value: 'ws://example.test/ws/user' },
    })
    fireEvent.change(screen.getByLabelText('Your user ID'), {
      target: { value: 'bob' },
    })
    await user.click(screen.getByRole('button', { name: 'Connect' }))

    expect(onServerUrlChange).toHaveBeenLastCalledWith('ws://example.test/ws/user')
    expect(onUserIdChange).toHaveBeenLastCalledWith('bob')
    expect(onConnect).toHaveBeenCalledTimes(1)
    expect(onDisconnect).not.toHaveBeenCalled()
  })
})
