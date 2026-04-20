import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectionControls } from './ConnectionControls'

describe('ConnectionControls', () => {
  test('shows the Google redirect CTA and authenticated actions', async () => {
    const user = userEvent.setup()
    const onServerUrlChange = vi.fn()
    const onConnect = vi.fn()
    const onLogout = vi.fn()
    const onStartGoogleLogin = vi.fn()

    render(
      <ConnectionControls
        authError={null}
        authStatus="authenticated"
        currentUser={{
          userId: 'user-1',
          username: 'alice',
          email: 'alice@example.com',
          displayName: 'Alice Example',
          provider: 'google',
        }}
        providerLabel="Google"
        providerRedirectEnabled
        serverUrl="ws://192.168.0.10:8080/ws/user"
        status="disconnected"
        onServerUrlChange={onServerUrlChange}
        onConnect={onConnect}
        onLogout={onLogout}
        onStartGoogleLogin={onStartGoogleLogin}
      />,
    )

    fireEvent.change(screen.getByLabelText('Server URL'), {
      target: { value: 'ws://example.test/ws/user' },
    })
    await user.click(screen.getByRole('button', { name: /continue with google/i }))
    await user.click(screen.getByRole('button', { name: 'Enter workspace' }))
    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(onServerUrlChange).toHaveBeenLastCalledWith('ws://example.test/ws/user')
    expect(onStartGoogleLogin).toHaveBeenCalledTimes(1)
    expect(onConnect).toHaveBeenCalledTimes(1)
    expect(onLogout).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Alice Example')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Your identity is verified. Continue into the workspace or switch accounts if needed.',
      ),
    ).toBeInTheDocument()
  })

  test('renders unauthenticated guidance and keeps redirect available', async () => {
    const user = userEvent.setup()
    const onStartGoogleLogin = vi.fn()

    render(
      <ConnectionControls
        authError="Google redirect is not configured."
        authStatus="unauthenticated"
        currentUser={null}
        providerLabel="Google"
        providerRedirectEnabled={false}
        serverUrl="ws://192.168.0.10:8080/ws/user"
        status="disconnected"
        onServerUrlChange={vi.fn()}
        onConnect={vi.fn()}
        onLogout={vi.fn()}
        onStartGoogleLogin={onStartGoogleLogin}
        showStatusRow={false}
        showLogout={false}
        idPrefix="welcome"
        layout="stacked"
      />,
    )

    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enter workspace' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /continue with google/i }))
    expect(onStartGoogleLogin).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Google redirect is not configured.')).toBeInTheDocument()
    expect(screen.getByLabelText('Server URL')).toHaveAttribute('id', 'welcome-server-url')
  })
})
