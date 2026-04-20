import type { ChangeEvent } from 'react'
import { motion } from 'framer-motion'
import type { AuthUserProfile } from '../../../shared/types/auth'
import type { ConnectionStatus } from '../../../shared/types/chat'
import {
  itemReveal,
  listStagger,
  panelTransition,
  sectionReveal,
} from '../../../shared/motion/presets'
import './WelcomeExperience.css'

type AuthStatus = 'authenticated' | 'authenticating' | 'checking' | 'unauthenticated'

interface WelcomeExperienceProps {
  authError: string | null
  authStatus: AuthStatus
  currentUser: AuthUserProfile | null
  providerLabel: string
  providerRedirectEnabled: boolean
  serverUrl: string
  status: ConnectionStatus
  onServerUrlChange: (value: string) => void
  onConnect: () => void
  onLogout: () => void
  onStartGoogleLogin: () => void
}

function getProfileLabel(currentUser: AuthUserProfile | null) {
  if (!currentUser) {
    return 'Not signed in'
  }

  return currentUser.displayName?.trim() || currentUser.email || currentUser.username
}

function getUserLabel(currentUser: AuthUserProfile | null) {
  if (!currentUser) {
    return 'your account'
  }

  return currentUser.displayName?.trim() || currentUser.email || currentUser.username
}

function getStatusCopy(authStatus: AuthStatus, status: ConnectionStatus) {
  if (authStatus === 'authenticated' && status === 'connected') {
    return 'Workspace connected.'
  }

  if (authStatus === 'authenticated') {
    return 'Session ready. Enter the workspace.'
  }

  if (authStatus === 'authenticating' || authStatus === 'checking') {
    return 'Checking your session.'
  }

  return 'Sign in to continue.'
}

function getCardTitle(authStatus: AuthStatus) {
  if (authStatus === 'authenticated') {
    return 'Welcome back'
  }

  if (authStatus === 'authenticating' || authStatus === 'checking') {
    return 'Signing you in'
  }

  return 'Sign in to Whispers'
}

function getCardCopy(
  authStatus: AuthStatus,
  currentUser: AuthUserProfile | null,
  providerLabel: string,
) {
  if (authStatus === 'authenticated' && currentUser) {
    return `Signed in as ${getUserLabel(currentUser)}.`
  }

  if (authStatus === 'authenticating' || authStatus === 'checking') {
    return 'Please wait while we restore your session.'
  }

  return `Continue with ${providerLabel} to access protected chats.`
}

export function WelcomeExperience({
  authError,
  authStatus,
  currentUser,
  providerLabel,
  providerRedirectEnabled,
  serverUrl,
  status,
  onServerUrlChange,
  onConnect,
  onLogout,
  onStartGoogleLogin,
}: WelcomeExperienceProps) {
  const profileLabel = getProfileLabel(currentUser)
  const statusCopy = getStatusCopy(authStatus, status)
  const cardTitle = getCardTitle(authStatus)
  const cardCopy = getCardCopy(authStatus, currentUser, providerLabel)
  const providerName = currentUser?.provider ?? providerLabel.toLowerCase()
  const isAuthenticated = authStatus === 'authenticated'
  const isBusy = authStatus === 'authenticating' || authStatus === 'checking'
  const handleServerUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    onServerUrlChange(event.target.value)
  }

  return (
    <motion.div
      className="welcome-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.42 } }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="welcome-surface"
        variants={sectionReveal}
        initial="hidden"
        animate="visible"
        exit={{ opacity: 0, y: -16, scale: 0.985, filter: 'blur(16px)' }}
        transition={panelTransition}
      >
        <div className="welcome-backdrop-grid" aria-hidden="true" />
        <motion.div className="welcome-content" variants={listStagger}>
          <motion.section className="welcome-auth-card" variants={itemReveal}>
            <div className="welcome-auth-card__header">
              <p className="eyebrow">Whispers</p>
              <h3 className="welcome-auth-card__title">{cardTitle}</h3>
              <p className="welcome-auth-card__copy">{cardCopy}</p>
            </div>

            <div className="welcome-auth-fields">
              <label className="welcome-field" htmlFor="welcome-server-url">
                <span className="welcome-field__label">Server URL</span>
                <input
                  id="welcome-server-url"
                  className="welcome-field__input"
                  value={serverUrl}
                  onChange={handleServerUrlChange}
                />
              </label>

              {currentUser ? (
                <div className="welcome-session-card">
                  <div className="welcome-session-card__label">Account</div>
                  <div className="welcome-session-card__value">{profileLabel}</div>
                  {currentUser.email ? (
                    <div className="welcome-session-card__meta">{currentUser.email}</div>
                  ) : null}
                  <div className="welcome-session-card__meta">Provider: {providerName}</div>
                </div>
              ) : null}
            </div>

            <div className="welcome-actions">
              {isAuthenticated ? (
                <>
                  <button type="button" onClick={onConnect}>
                    {status === 'connected' ? 'Enter workspace' : 'Open workspace'}
                  </button>
                  <button className="secondary" type="button" onClick={onLogout}>
                    Sign out
                  </button>
                </>
              ) : (
                <button
                  className="google-auth-button"
                  type="button"
                  onClick={onStartGoogleLogin}
                  disabled={isBusy}
                >
                  <span className="google-auth-button__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path
                        fill="#4285F4"
                        d="M21.8 12.23c0-.76-.07-1.49-.2-2.2H12v4.16h5.48a4.69 4.69 0 0 1-2.03 3.08v2.55h3.28c1.92-1.76 3.07-4.36 3.07-7.59Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 22c2.76 0 5.08-.91 6.77-2.48l-3.28-2.55c-.91.61-2.07.97-3.49.97-2.68 0-4.95-1.81-5.76-4.24H2.86v2.63A10 10 0 0 0 12 22Z"
                      />
                      <path
                        fill="#FBBC04"
                        d="M6.24 13.7A5.98 5.98 0 0 1 5.92 12c0-.59.1-1.16.32-1.7V7.67H2.86A10 10 0 0 0 2 12c0 1.61.39 3.14 1.09 4.33l3.15-2.63Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 6.06c1.5 0 2.85.52 3.91 1.54l2.93-2.93C17.07 2.95 14.75 2 12 2A10 10 0 0 0 2.86 7.67l3.38 2.63C7.05 7.87 9.32 6.06 12 6.06Z"
                      />
                    </svg>
                  </span>
                  <span className="google-auth-button__content">
                    <span className="google-auth-button__title">
                      {isBusy ? 'Checking session...' : `Continue with ${providerLabel}`}
                    </span>
                    <span className="google-auth-button__subtitle">
                      {providerRedirectEnabled
                        ? 'OIDC redirect with PKCE'
                        : 'Provider redirect requires configuration'}
                    </span>
                  </span>
                </button>
              )}
            </div>

            <div className="welcome-feedback">
              {authError ? (
                <p className="welcome-feedback__message welcome-feedback__message--error">
                  {authError}
                </p>
              ) : null}
              {!providerRedirectEnabled ? (
                <p className="welcome-feedback__message">
                  Provider redirect is not configured for this environment.
                </p>
              ) : null}
              {!authError ? (
                <p className="welcome-feedback__message">{statusCopy}</p>
              ) : null}
            </div>
          </motion.section>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
