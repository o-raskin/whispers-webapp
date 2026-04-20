import {
  fetchCurrentUser,
  loginWithProvider,
  refreshSession,
} from './authApi'

describe('authApi', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('normalizes common auth user profile aliases from login responses', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        accessToken: 'access-token',
        tokenType: 'Bearer',
        expiresInSeconds: 86400,
        user: {
          userId: 'user-1',
          username: 'oleg@example.com',
          email: 'oleg@example.com',
          first_name: 'Oleg',
          last_name: 'Raskin',
          picture: 'https://example.com/photo.png',
          provider: 'google',
        },
      }),
    })

    await expect(
      loginWithProvider('wss://chat.example.com/ws/user', 'google', {
        code: 'code',
        redirectUri: 'https://localhost:5173/auth/callback/google',
        codeVerifier: 'verifier',
        nonce: 'nonce',
      }),
    ).resolves.toEqual({
      accessToken: 'access-token',
      tokenType: 'Bearer',
      expiresInSeconds: 86400,
      user: {
        userId: 'user-1',
        username: 'oleg@example.com',
        email: 'oleg@example.com',
        firstName: 'Oleg',
        lastName: 'Raskin',
        pictureUrl: 'https://example.com/photo.png',
        provider: 'google',
      },
    })
  })

  test('normalizes current user profile aliases from auth me', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        userId: 'user-1',
        username: 'oleg@example.com',
        email: 'oleg@example.com',
        firstName: 'Oleg',
        lastName: 'Raskin',
        picture_url: 'https://example.com/profile.png',
        provider: 'google',
      }),
    })

    await expect(
      fetchCurrentUser('ws://localhost:8080/ws/user', 'access-token'),
    ).resolves.toEqual({
      userId: 'user-1',
      username: 'oleg@example.com',
      email: 'oleg@example.com',
      firstName: 'Oleg',
      lastName: 'Raskin',
      pictureUrl: 'https://example.com/profile.png',
      provider: 'google',
    })
  })

  test('normalizes refresh payload user aliases', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        accessToken: 'next-token',
        tokenType: 'Bearer',
        expiresInSeconds: 86400,
        user: {
          userId: 'user-1',
          username: 'oleg@example.com',
          email: 'oleg@example.com',
          displayName: 'Oleg Raskin',
          imageUrl: 'https://example.com/refreshed.png',
          provider: 'google',
        },
      }),
    })

    await expect(refreshSession('ws://localhost:8080/ws/user')).resolves.toEqual({
      accessToken: 'next-token',
      tokenType: 'Bearer',
      expiresInSeconds: 86400,
      user: {
        userId: 'user-1',
        username: 'oleg@example.com',
        email: 'oleg@example.com',
        displayName: 'Oleg Raskin',
        pictureUrl: 'https://example.com/refreshed.png',
        provider: 'google',
      },
    })
  })
})
