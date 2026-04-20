import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WelcomeExperience } from './WelcomeExperience'

describe('WelcomeExperience', () => {
  test('renders the authenticated user and delegates welcome actions', async () => {
    const user = userEvent.setup()
    const onServerUrlChange = vi.fn()
    const onConnect = vi.fn()
    const onLogout = vi.fn()
    const onStartGoogleLogin = vi.fn()

    render(
      <WelcomeExperience
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
        status="connected"
        onServerUrlChange={onServerUrlChange}
        onConnect={onConnect}
        onLogout={onLogout}
        onStartGoogleLogin={onStartGoogleLogin}
      />,
    )

    expect(screen.getByText('Alice Example')).toBeInTheDocument()
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByText('Signed in as Alice Example.')).toBeInTheDocument()
    expect(screen.getByText('Provider: google')).toBeInTheDocument()
    expect(screen.getByText('Workspace connected.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Server URL'), {
      target: { value: 'ws://example.test/ws/user' },
    })
    await user.click(screen.getByRole('button', { name: 'Enter workspace' }))

    expect(onServerUrlChange).toHaveBeenLastCalledWith('ws://example.test/ws/user')
    expect(onStartGoogleLogin).not.toHaveBeenCalled()
    expect(onConnect).toHaveBeenCalledTimes(1)
    expect(onLogout).not.toHaveBeenCalled()
  })
})
