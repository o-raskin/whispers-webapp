import type { ChangeEvent } from 'react'
import { motion } from 'framer-motion'
import type { AuthUserProfile } from '../../../shared/types/auth'
import type { ConnectionStatus } from '../../../shared/types/chat'
import {
  itemReveal,
  listStagger,
  springTransition,
} from '../../../shared/motion/presets'

type AuthStatus = 'authenticated' | 'authenticating' | 'checking' | 'unauthenticated'

interface ConnectionControlsProps {
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
  idPrefix?: string
  layout?: 'inline' | 'stacked'
  showStatusRow?: boolean
  showLogout?: boolean
}

function getStatusCopy(authStatus: AuthStatus, status: ConnectionStatus, providerLabel: string) {
  if (authStatus === 'authenticated' && status === 'connected') {
    return 'Realtime channel is live. Conversations, presence, and protected requests are authenticated.'
  }

  if (authStatus === 'authenticated' && status === 'connecting') {
    return 'Signing in succeeded. Reconnecting the protected realtime workspace now.'
  }

  if (authStatus === 'authenticated') {
    return 'Your identity is verified. Continue into the workspace or switch accounts if needed.'
  }

  if (authStatus === 'authenticating' || authStatus === 'checking') {
    return 'Confirming your session and preparing a protected workspace.'
  }

  return `Continue with ${providerLabel} to complete OIDC sign-in and unlock chats.`
}

function getProfileLabel(currentUser: AuthUserProfile | null) {
  if (!currentUser) {
    return 'Not signed in yet'
  }

  return currentUser.displayName?.trim() || currentUser.email || currentUser.username
}

export function ConnectionControls({
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
  idPrefix = 'connection',
  layout = 'inline',
  showStatusRow = true,
  showLogout = true,
}: ConnectionControlsProps) {
  const handleInput =
    (setter: (value: string) => void) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setter(event.target.value)
    }

  const isAuthenticated = authStatus === 'authenticated'
  const isBusy = authStatus === 'authenticating' || authStatus === 'checking'
  const statusCopy = getStatusCopy(authStatus, status, providerLabel)
  const providerNote = currentUser?.provider ?? providerLabel.toLowerCase()
  const redirectHint = providerRedirectEnabled
    ? 'OIDC redirect with PKCE'
    : 'Launch sign-in and verify provider redirect configuration'

  return (
    <>
      <motion.div
        className={`connection-grid connection-grid--${layout}`}
        variants={listStagger}
      >
        <motion.div className="field-card" variants={itemReveal}>
          <label htmlFor={`${idPrefix}-server-url`}>Server URL</label>
          <input
            id={`${idPrefix}-server-url`}
            value={serverUrl}
            onChange={handleInput(onServerUrlChange)}
          />
        </motion.div>

        <motion.div className="field-card field-card--auth" variants={itemReveal}>
          <span className="field-label">Authenticated user</span>
          <div className="auth-summary">
            <div className="auth-summary-title">{getProfileLabel(currentUser)}</div>
            <div className="auth-summary-copy">
              {currentUser
                ? `${currentUser.email} · provider ${providerNote}`
                : `Sign in with ${providerLabel} to access protected chats and presence.`}
            </div>
          </div>
        </motion.div>

        <motion.div
          className={`connection-actions connection-actions--${layout}`}
          variants={itemReveal}
        >
          <motion.button
            className="google-auth-button"
            type="button"
            onClick={onStartGoogleLogin}
            disabled={isBusy}
            whileHover={{ y: -2, scale: !isBusy ? 1.01 : 1 }}
            whileTap={{ scale: !isBusy ? 0.985 : 1 }}
            transition={springTransition}
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
                {isBusy ? 'Preparing secure redirect…' : `Continue with ${providerLabel}`}
              </span>
              <span className="google-auth-button__subtitle">{redirectHint}</span>
            </span>
          </motion.button>

          {isAuthenticated ? (
            <motion.button
              type="button"
              onClick={onConnect}
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.985 }}
              transition={springTransition}
            >
              {status === 'connected' ? 'Workspace connected' : 'Enter workspace'}
            </motion.button>
          ) : null}

          {showLogout && currentUser ? (
            <motion.button
              className="secondary"
              type="button"
              onClick={onLogout}
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.985 }}
              transition={springTransition}
            >
              Sign out
            </motion.button>
          ) : null}
        </motion.div>
      </motion.div>

      {showStatusRow ? (
        <motion.div className="status-row" variants={itemReveal}>
          <motion.span
            className={`status-pill ${status}`}
            layout
            transition={springTransition}
          >
            {authStatus === 'authenticated' ? status : authStatus}
          </motion.span>
          <p className="status-copy">{statusCopy}</p>
        </motion.div>
      ) : null}

      {authError ? (
        <motion.p className="auth-inline-error" variants={itemReveal}>
          {authError}
        </motion.p>
      ) : null}
    </>
  )
}
