import {
  createSessionFromLogin,
  getAuthCallbackProvider,
  getCurrentUserLabel,
  getProviderLabel,
} from './authFlow'

describe('authFlow', () => {
  test('creates an expiring session from a login payload', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-20T08:00:00Z'))

    expect(
      createSessionFromLogin(
        {
          accessToken: 'token-1',
          expiresInSeconds: 60,
          tokenType: 'Bearer',
          user: {
            userId: 'user-1',
            username: 'alice',
            email: 'alice@example.com',
            displayName: 'Alice Example',
            provider: 'google',
          },
        },
        'google',
      ),
    ).toEqual({
      accessToken: 'token-1',
      expiresAt: Date.parse('2026-04-20T08:01:00Z'),
      provider: 'google',
      tokenType: 'Bearer',
    })

    vi.useRealTimers()
  })

  test('prefers the provider encoded in the auth callback route', () => {
    window.history.replaceState({}, '', '/auth/callback/github?code=test-code')

    expect(getAuthCallbackProvider('google')).toBe('github')
  })

  test('prefers display name, then email, then username for the current user label', () => {
    expect(
      getCurrentUserLabel({
        userId: 'user-1',
        username: 'alice',
        email: 'alice@example.com',
        displayName: 'Alice Example',
        provider: 'google',
      }),
    ).toBe('Alice Example')

    expect(
      getCurrentUserLabel({
        userId: 'user-2',
        username: 'bob',
        email: 'bob@example.com',
        displayName: '   ',
        provider: 'google',
      }),
    ).toBe('bob@example.com')

    expect(
      getCurrentUserLabel({
        userId: 'user-3',
        username: 'carol',
        email: '',
        displayName: undefined,
        provider: 'google',
      }),
    ).toBe('carol')

    expect(getCurrentUserLabel(null)).toBe('')
  })

  test('maps a provider id back to its display label', () => {
    expect(getProviderLabel('google')).toBe('Google')
    expect(getProviderLabel('custom-provider')).toBe('custom-provider')
  })
})
